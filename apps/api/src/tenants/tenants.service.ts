import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InviteStatus, JoinRequestStatus, ReservationStatus, Role } from "@erp/types";
import { generateId, generateJoinCode, generatePrefixedId } from "@erp/utils";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryPoolsService } from "../inventory/inventory-pools.service";
import { AuditAction, AuditEntityType } from "../audit/audit.constants";
import { AuditService } from "../audit/audit.service";
import { PropelAuthService } from "../auth/propelauth.service";
import {
  hasImplicitBranchAccess,
  UserBranchStatus,
} from "./branch-access.constants";

const VALID_ROLES = new Set(Object.values(Role));

const BLOCKING_BRANCH_RESERVATIONS: string[] = [
  ReservationStatus.INQUIRY,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

type MemberWithUser = {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  createdAt: Date;
  user: { id: string; email: string; name: string | null };
};

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryPools: InventoryPoolsService,
    private readonly audit: AuditService,
    private readonly propelAuth: PropelAuthService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async listOrganizations(userId: string) {
    const memberships = await this.prisma.userOrganization.findMany({
      where: { userId },
      include: { organization: { include: { branches: { orderBy: { name: "asc" } } } } },
      orderBy: { organization: { name: "asc" } },
    });

    return Promise.all(
      memberships.map(async (membership) => ({
        ...membership,
        organization: {
          ...membership.organization,
          branches: await this.filterAccessibleBranches(
            userId,
            membership.organizationId,
            membership.role,
            membership.organization.branches,
          ),
        },
      })),
    );
  }

  private async filterAccessibleBranches(
    userId: string,
    organizationId: string,
    role: string,
    branches: { id: string; name: string }[],
  ) {
    if (hasImplicitBranchAccess(role)) return branches;

    const grants = await this.prisma.userBranch.findMany({
      where: {
        userId,
        organizationId,
        status: UserBranchStatus.ACTIVE,
      },
      select: { branchId: true },
    });
    const allowed = new Set(grants.map((g) => g.branchId));
    return branches.filter((b) => allowed.has(b.id));
  }

  async userHasBranchAccess(
    userId: string,
    organizationId: string,
    role: string,
    branchId: string,
  ): Promise<boolean> {
    if (hasImplicitBranchAccess(role)) return true;

    const grant = await this.prisma.userBranch.findUnique({
      where: { userId_branchId: { userId, branchId } },
    });
    return (
      !!grant &&
      grant.organizationId === organizationId &&
      grant.status === UserBranchStatus.ACTIVE
    );
  }

  countMemberships(userId: string) {
    return this.prisma.userOrganization.count({ where: { userId } });
  }

  getOrganization(organizationId: string) {
    return this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { branches: { orderBy: { name: "asc" } } },
    });
  }

  async updateOrganization(
    organizationId: string,
    data: { name?: string },
    actingUserId?: string,
  ) {
    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException("Organization name is required");
    }

    const org = await this.prisma.organization.update({
      where: { id: organizationId },
      data: data.name !== undefined ? { name: data.name.trim() } : data,
      include: { branches: { orderBy: { name: "asc" } } },
    });

    await this.audit.record({
      organizationId,
      userId: actingUserId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.ORGANIZATION,
      entityId: organizationId,
      metadata: { name: org.name },
    });

    if (data.name !== undefined && !org.propelAuthOrgId.startsWith("erp_")) {
      try {
        await this.propelAuth.updateOrg(org.propelAuthOrgId, org.name);
      } catch (err) {
        this.logger.warn(
          `PropelAuth updateOrg failed for ${organizationId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return org;
  }

  private async uniqueJoinCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const joinCode = generateJoinCode();
      const existing = await this.prisma.organization.findUnique({
        where: { joinCode },
        select: { id: true },
      });
      if (!existing) return joinCode;
    }
    throw new ConflictException("Could not generate join code");
  }

  async createOrganization(
    userId: string,
    data: { name: string; timezone: string; propelAuthOrgId?: string },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("Organization name is required");
    if (!data.timezone?.trim()) throw new BadRequestException("Timezone is required");

    const propelAuthOrgId = data.propelAuthOrgId ?? `erp_${generatePrefixedId("org")}`;
    const joinCode = await this.uniqueJoinCode();

    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          propelAuthOrgId,
          name: data.name.trim(),
          joinCode,
        },
      });

      const branch = await tx.branch.create({
        data: {
          organizationId: org.id,
          name: "Main Branch",
          timezone: data.timezone.trim(),
        },
      });

      await tx.userOrganization.create({
        data: {
          userId,
          organizationId: org.id,
          role: Role.OWNER,
        },
      });

      return { organization: { ...org, branches: [branch] }, branch };
    });

    await this.inventoryPools.seedDefaultPools(result.organization.id);

    let linkedPropelAuthOrgId = result.organization.propelAuthOrgId;
    let propelAuthSynced = false;

    if (!data.propelAuthOrgId) {
      try {
        linkedPropelAuthOrgId = await this.ensurePropelAuthOrganization({
          id: result.organization.id,
          propelAuthOrgId: result.organization.propelAuthOrgId,
          name: result.organization.name,
        });
        result.organization.propelAuthOrgId = linkedPropelAuthOrgId;
      } catch (err) {
        this.logger.warn(
          `PropelAuth createOrg failed for ERP org ${result.organization.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { propelAuthUserId: true },
    });

    if (creator?.propelAuthUserId && !linkedPropelAuthOrgId.startsWith("erp_")) {
      try {
        await this.propelAuth.addUserToOrg(
          linkedPropelAuthOrgId,
          creator.propelAuthUserId,
        );
        propelAuthSynced = true;
      } catch (err) {
        this.logger.warn(
          `PropelAuth addUserToOrg failed for ERP org ${result.organization.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return { ...result, propelAuthSynced };
  }

  async getOnboardingStatus(userId: string) {
    const membershipCount = await this.prisma.userOrganization.count({
      where: { userId },
    });

    const pendingRequest = await this.prisma.organizationJoinRequest.findFirst({
      where: { userId, status: JoinRequestStatus.PENDING },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return {
      hasMembership: membershipCount > 0,
      canAccessApp: membershipCount > 0,
      pendingRequest: pendingRequest
        ? {
            id: pendingRequest.id,
            organizationId: pendingRequest.organizationId,
            organizationName: pendingRequest.organization.name,
            message: pendingRequest.message,
            createdAt: pendingRequest.createdAt,
          }
        : null,
    };
  }

  searchOrganizations(query: string) {
    const q = query.trim();
    if (q.length < 2) {
      throw new BadRequestException("Search query must be at least 2 characters");
    }

    return this.prisma.organization.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true },
      take: 20,
      orderBy: { name: "asc" },
    });
  }

  getOrganizationByJoinCode(code: string) {
    const joinCode = code.trim().toLowerCase();
    if (!joinCode) throw new BadRequestException("Join code is required");

    return this.prisma.organization.findUnique({
      where: { joinCode },
      select: { id: true, name: true },
    });
  }

  async createJoinRequest(
    userId: string,
    data: { organizationId?: string; joinCode?: string; message?: string },
  ) {
    if (!data.organizationId && !data.joinCode) {
      throw new BadRequestException("organizationId or joinCode is required");
    }

    let organizationId = data.organizationId;
    if (!organizationId && data.joinCode) {
      const org = await this.getOrganizationByJoinCode(data.joinCode);
      if (!org) throw new NotFoundException("Organization not found for join code");
      organizationId = org.id;
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const existingInOrg = await this.prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: org.id },
      },
    });
    if (existingInOrg) {
      throw new ConflictException("You are already a member of this organization");
    }

    const pending = await this.prisma.organizationJoinRequest.findFirst({
      where: { userId, status: JoinRequestStatus.PENDING },
    });
    if (pending) {
      throw new ConflictException("You already have a pending join request");
    }

    return this.prisma.organizationJoinRequest.create({
      data: {
        id: generateId("OrganizationJoinRequest"),
        organizationId: org.id,
        userId,
        message: data.message?.trim() || null,
        status: JoinRequestStatus.PENDING,
      },
      include: {
        organization: { select: { id: true, name: true } },
      },
    });
  }

  async cancelJoinRequest(userId: string, requestId: string) {
    const request = await this.prisma.organizationJoinRequest.findFirst({
      where: { id: requestId, userId },
    });
    if (!request) throw new NotFoundException("Join request not found");
    if (request.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException("Only pending requests can be cancelled");
    }

    return this.prisma.organizationJoinRequest.update({
      where: { id: requestId },
      data: { status: JoinRequestStatus.CANCELLED },
    });
  }

  listMyJoinRequests(userId: string) {
    return this.prisma.organizationJoinRequest.findMany({
      where: { userId },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  listPendingJoinRequests(organizationId: string) {
    return this.prisma.organizationJoinRequest.findMany({
      where: { organizationId, status: JoinRequestStatus.PENDING },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  private assertValidRole(role: string): Role {
    if (!VALID_ROLES.has(role as Role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }
    return role as Role;
  }

  async approveJoinRequest(
    reviewerUserId: string,
    organizationId: string,
    requestId: string,
    role: string,
  ) {
    const assignedRole = this.assertValidRole(role);

    const request = await this.prisma.organizationJoinRequest.findFirst({
      where: { id: requestId, organizationId, status: JoinRequestStatus.PENDING },
      include: { user: true },
    });
    if (!request) throw new NotFoundException("Pending join request not found");

    const existingMembership = await this.prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: request.userId,
          organizationId,
        },
      },
    });
    if (existingMembership) {
      throw new ConflictException("User is already a member of this organization");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.userOrganization.create({
        data: {
          userId: request.userId,
          organizationId,
          role: assignedRole,
        },
      });

      const result = await tx.organizationJoinRequest.update({
        where: { id: requestId },
        data: {
          status: JoinRequestStatus.APPROVED,
          assignedRole,
          reviewedByUserId: reviewerUserId,
          reviewedAt: new Date(),
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
          organization: { select: { id: true, name: true } },
        },
      });

      await tx.organizationJoinRequest.updateMany({
        where: {
          userId: request.userId,
          status: JoinRequestStatus.PENDING,
          id: { not: requestId },
        },
        data: { status: JoinRequestStatus.CANCELLED },
      });

      return result;
    });

    await this.audit.record({
      organizationId,
      userId: reviewerUserId,
      action: AuditAction.APPROVE,
      entityType: AuditEntityType.JOIN_REQUEST,
      entityId: requestId,
      metadata: { memberUserId: request.userId, role: assignedRole },
    });

    return updated;
  }

  async rejectJoinRequest(
    reviewerUserId: string,
    organizationId: string,
    requestId: string,
    reason?: string,
  ) {
    const request = await this.prisma.organizationJoinRequest.findFirst({
      where: { id: requestId, organizationId, status: JoinRequestStatus.PENDING },
    });
    if (!request) throw new NotFoundException("Pending join request not found");

    const updated = await this.prisma.organizationJoinRequest.update({
      where: { id: requestId },
      data: {
        status: JoinRequestStatus.REJECTED,
        message: reason?.trim() ? reason.trim() : request.message,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      },
    });

    await this.audit.record({
      organizationId,
      userId: reviewerUserId,
      action: AuditAction.REJECT,
      entityType: AuditEntityType.JOIN_REQUEST,
      entityId: requestId,
    });

    return updated;
  }

  private async getFounderUserId(organizationId: string): Promise<string | null> {
    const founder = await this.prisma.userOrganization.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
    });
    return founder?.userId ?? null;
  }

  async listMembers(organizationId: string) {
    const members = (await this.prisma.userOrganization.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    })) as MemberWithUser[];

    const founderUserId = members[0]?.userId ?? null;

    return members.map((membership) => ({
      ...membership,
      isFounder: membership.userId === founderUserId,
    }));
  }

  async updateMemberRole(
    organizationId: string,
    targetUserId: string,
    role: string,
    actingUserId: string,
  ) {
    const newRole = this.assertValidRole(role);

    if (targetUserId === actingUserId && newRole !== Role.OWNER && newRole !== Role.ADMIN) {
      // allow self-demotion only if not last owner — checked below
    }

    const membership = await this.prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: { userId: targetUserId, organizationId },
      },
    });
    if (!membership) throw new NotFoundException("Member not found");

    if (membership.role === Role.OWNER && newRole !== Role.OWNER) {
      const ownerCount = await this.prisma.userOrganization.count({
        where: { organizationId, role: Role.OWNER },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException("Cannot change role of the last owner");
      }
    }

    const updated = await this.prisma.userOrganization.update({
      where: { id: membership.id },
      data: { role: newRole },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    await this.audit.record({
      organizationId,
      userId: actingUserId,
      action: AuditAction.ROLE_CHANGE,
      entityType: AuditEntityType.USER_ORGANIZATION,
      entityId: membership.id,
      metadata: { targetUserId, role: newRole },
    });

    return updated;
  }

  async removeMember(organizationId: string, targetUserId: string, actingUserId: string) {
    const founderUserId = await this.getFounderUserId(organizationId);
    if (founderUserId && targetUserId === founderUserId) {
      throw new ForbiddenException("Cannot remove the organization founder");
    }

    const membership = await this.prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: { userId: targetUserId, organizationId },
      },
    });
    if (!membership) throw new NotFoundException("Member not found");

    if (membership.role === Role.OWNER) {
      const ownerCount = await this.prisma.userOrganization.count({
        where: { organizationId, role: Role.OWNER },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException("Cannot remove the last owner");
      }
    }

    if (targetUserId === actingUserId) {
      throw new ForbiddenException("You cannot remove yourself from the organization");
    }

    await this.prisma.userOrganization.delete({
      where: { id: membership.id },
    });

    await this.audit.record({
      organizationId,
      userId: actingUserId,
      action: AuditAction.REMOVE_MEMBER,
      entityType: AuditEntityType.USER_ORGANIZATION,
      entityId: membership.id,
      metadata: { targetUserId },
    });

    return { removed: true, userId: targetUserId };
  }

  listBranches(organizationId: string) {
    return this.prisma.branch.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  async createBranch(
    organizationId: string,
    data: { name: string; timezone: string },
    actingUserId?: string,
  ) {
    if (!data.name?.trim()) throw new BadRequestException("Branch name is required");
    if (!data.timezone?.trim()) throw new BadRequestException("Timezone is required");

    const branch = await this.prisma.branch.create({
      data: {
        organizationId,
        name: data.name.trim(),
        timezone: data.timezone.trim(),
      },
    });

    await this.audit.record({
      organizationId,
      userId: actingUserId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.BRANCH,
      entityId: branch.id,
      metadata: { name: branch.name },
    });

    return branch;
  }

  async updateBranch(
    branchId: string,
    organizationId: string,
    data: { name?: string; timezone?: string },
    actingUserId?: string,
  ) {
    const existing = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
    if (!existing) throw new NotFoundException("Branch not found");

    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException("Branch name is required");
    }
    if (data.timezone !== undefined && !data.timezone.trim()) {
      throw new BadRequestException("Timezone is required");
    }

    const branch = await this.prisma.branch.update({
      where: { id: branchId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone.trim() } : {}),
      },
    });

    await this.audit.record({
      organizationId,
      userId: actingUserId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.BRANCH,
      entityId: branchId,
      metadata: { name: branch.name },
    });

    return branch;
  }

  getBranch(branchId: string, organizationId: string) {
    return this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
  }

  async deleteBranch(branchId: string, organizationId: string, actingUserId?: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    const branchCount = await this.prisma.branch.count({
      where: { organizationId },
    });
    if (branchCount <= 1) {
      throw new BadRequestException("Cannot delete the last branch in the organization");
    }

    const activeReservations = await this.prisma.reservation.count({
      where: {
        branchId,
        status: { in: BLOCKING_BRANCH_RESERVATIONS },
      },
    });
    if (activeReservations > 0) {
      throw new ConflictException(
        "Branch has active reservations and cannot be deleted",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.updateMany({
        where: { branchId },
        data: { branchId: null },
      });
      await tx.reportJob.updateMany({
        where: { branchId },
        data: { branchId: null },
      });
      await tx.branch.delete({ where: { id: branchId } });
    });

    await this.audit.record({
      organizationId,
      userId: actingUserId,
      action: AuditAction.DELETE,
      entityType: AuditEntityType.BRANCH,
      entityId: branchId,
      metadata: { name: branch.name },
    });

    return { deleted: true, id: branchId };
  }

  /** Ensures a PropelAuth org exists for ERP orgs created with synthetic IDs. */
  async ensurePropelAuthOrganization(org: {
    id: string;
    propelAuthOrgId: string;
    name: string;
  }): Promise<string> {
    const existing = await this.propelAuth.fetchOrg(org.propelAuthOrgId);
    if (existing) return org.propelAuthOrgId;

    const created = await this.propelAuth.createOrg(org.name, org.id);
    await this.prisma.organization.update({
      where: { id: org.id },
      data: { propelAuthOrgId: created.orgId },
    });
    return created.orgId;
  }

  listPendingInvites(organizationId: string) {
    return this.prisma.organizationInvite.findMany({
      where: { organizationId, status: InviteStatus.PENDING },
      include: {
        invitedBy: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async inviteMember(
    organizationId: string,
    invitedByUserId: string,
    data: { email: string; role: string },
  ) {
    const email = this.normalizeEmail(data.email);
    if (!email || !email.includes("@")) {
      throw new BadRequestException("A valid email address is required");
    }
    const assignedRole = this.assertValidRole(data.role);

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const membership = await this.prisma.userOrganization.findUnique({
        where: {
          userId_organizationId: { userId: existingUser.id, organizationId },
        },
      });
      if (membership) {
        throw new ConflictException("This user is already a member of the organization");
      }
    }

    const pendingInvite = await this.prisma.organizationInvite.findFirst({
      where: { organizationId, email, status: InviteStatus.PENDING },
    });
    if (pendingInvite) {
      throw new ConflictException("An invite is already pending for this email");
    }

    const propelAuthOrgId = await this.ensurePropelAuthOrganization(org);
    try {
      await this.propelAuth.inviteUserToOrg(propelAuthOrgId, email);
    } catch {
      throw new BadRequestException(
        "Could not send invite email. Check PropelAuth configuration and org roles.",
      );
    }

    const invite = await this.prisma.organizationInvite.create({
      data: {
        organizationId,
        email,
        role: assignedRole,
        invitedByUserId,
        status: InviteStatus.PENDING,
      },
      include: {
        invitedBy: { select: { id: true, email: true, name: true } },
      },
    });

    await this.audit.record({
      organizationId,
      userId: invitedByUserId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.ORG_INVITE,
      entityId: invite.id,
      metadata: { email, role: assignedRole },
    });

    return invite;
  }

  async revokeInvite(organizationId: string, inviteId: string, actingUserId: string) {
    const invite = await this.prisma.organizationInvite.findFirst({
      where: { id: inviteId, organizationId, status: InviteStatus.PENDING },
      include: { organization: true },
    });
    if (!invite) throw new NotFoundException("Pending invite not found");

    const propelAuthOrgId = await this.ensurePropelAuthOrganization(invite.organization);
    try {
      await this.propelAuth.revokePendingOrgInvite(propelAuthOrgId, invite.email);
    } catch {
      // PropelAuth invite may already be accepted or expired — still revoke locally.
    }

    const updated = await this.prisma.organizationInvite.update({
      where: { id: inviteId },
      data: { status: InviteStatus.REVOKED },
      include: {
        invitedBy: { select: { id: true, email: true, name: true } },
      },
    });

    await this.audit.record({
      organizationId,
      userId: actingUserId,
      action: AuditAction.REJECT,
      entityType: AuditEntityType.ORG_INVITE,
      entityId: inviteId,
      metadata: { email: invite.email },
    });

    return updated;
  }

  /** Accept pending email invites after PropelAuth login (ERP membership is authoritative). */
  async fulfillPendingInvitesForUser(userId: string, email: string) {
    const normalized = this.normalizeEmail(email);
    const invites = await this.prisma.organizationInvite.findMany({
      where: { email: normalized, status: InviteStatus.PENDING },
    });
    if (invites.length === 0) return [];

    const accepted: string[] = [];

    for (const invite of invites) {
      const existing = await this.prisma.userOrganization.findUnique({
        where: {
          userId_organizationId: { userId, organizationId: invite.organizationId },
        },
      });
      if (existing) {
        await this.prisma.organizationInvite.update({
          where: { id: invite.id },
          data: { status: InviteStatus.ACCEPTED, acceptedAt: new Date() },
        });
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.userOrganization.create({
          data: {
            userId,
            organizationId: invite.organizationId,
            role: invite.role,
          },
        });

        await tx.organizationInvite.update({
          where: { id: invite.id },
          data: { status: InviteStatus.ACCEPTED, acceptedAt: new Date() },
        });

        await tx.organizationJoinRequest.updateMany({
          where: {
            userId,
            organizationId: invite.organizationId,
            status: JoinRequestStatus.PENDING,
          },
          data: { status: JoinRequestStatus.CANCELLED },
        });
      });

      accepted.push(invite.organizationId);
    }

    return accepted;
  }

  async listBranchMembers(organizationId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    const [members, grants] = await Promise.all([
      this.prisma.userOrganization.findMany({
        where: { organizationId },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { user: { email: "asc" } },
      }),
      this.prisma.userBranch.findMany({
        where: { branchId, organizationId, status: UserBranchStatus.ACTIVE },
        select: { userId: true },
      }),
    ]);

    const granted = new Set(grants.map((g) => g.userId));

    return members.map((m) => ({
      userId: m.userId,
      role: m.role,
      user: m.user,
      implicitAccess: hasImplicitBranchAccess(m.role),
      hasBranchAccess: hasImplicitBranchAccess(m.role) || granted.has(m.userId),
    }));
  }

  async grantBranchAccess(
    organizationId: string,
    branchId: string,
    targetUserId: string,
    grantedByUserId: string,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    const membership = await this.prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: { userId: targetUserId, organizationId },
      },
    });
    if (!membership) {
      throw new BadRequestException("User is not a member of this organization");
    }
    if (hasImplicitBranchAccess(membership.role)) {
      throw new BadRequestException("Owners and admins already have access to all branches");
    }

    const row = await this.prisma.userBranch.upsert({
      where: { userId_branchId: { userId: targetUserId, branchId } },
      create: {
        organizationId,
        userId: targetUserId,
        branchId,
        status: UserBranchStatus.ACTIVE,
        grantedByUserId,
        approvedAt: new Date(),
      },
      update: {
        status: UserBranchStatus.ACTIVE,
        grantedByUserId,
        approvedAt: new Date(),
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    await this.audit.record({
      organizationId,
      userId: grantedByUserId,
      action: AuditAction.APPROVE,
      entityType: AuditEntityType.USER_BRANCH,
      entityId: row.id,
      metadata: { branchId, targetUserId },
    });

    return row;
  }

  async revokeBranchAccess(
    organizationId: string,
    branchId: string,
    targetUserId: string,
    actingUserId: string,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    const membership = await this.prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: { userId: targetUserId, organizationId },
      },
    });
    if (!membership) throw new NotFoundException("Member not found");
    if (hasImplicitBranchAccess(membership.role)) {
      throw new BadRequestException("Cannot revoke implicit branch access for owners and admins");
    }

    const existing = await this.prisma.userBranch.findUnique({
      where: { userId_branchId: { userId: targetUserId, branchId } },
    });
    if (!existing) throw new NotFoundException("Branch access grant not found");

    await this.prisma.userBranch.delete({ where: { id: existing.id } });

    await this.audit.record({
      organizationId,
      userId: actingUserId,
      action: AuditAction.DELETE,
      entityType: AuditEntityType.USER_BRANCH,
      entityId: existing.id,
      metadata: { branchId, targetUserId },
    });

    return { ok: true };
  }
}

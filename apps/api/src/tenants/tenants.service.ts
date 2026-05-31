import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JoinRequestStatus, Role } from "@erp/types";
import { generateId, generateJoinCode, generatePrefixedId } from "@erp/utils";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryPoolsService } from "../inventory/inventory-pools.service";

const VALID_ROLES = new Set(Object.values(Role));

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryPools: InventoryPoolsService,
  ) {}

  listOrganizations(userId: string) {
    return this.prisma.userOrganization.findMany({
      where: { userId },
      include: { organization: { include: { branches: { orderBy: { name: "asc" } } } } },
      orderBy: { organization: { name: "asc" } },
    });
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

  updateOrganization(organizationId: string, data: { name?: string }) {
    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException("Organization name is required");
    }

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: data.name !== undefined ? { name: data.name.trim() } : data,
      include: { branches: { orderBy: { name: "asc" } } },
    });
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
    return result;
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

    return this.prisma.$transaction(async (tx) => {
      await tx.userOrganization.create({
        data: {
          userId: request.userId,
          organizationId,
          role: assignedRole,
        },
      });

      const updated = await tx.organizationJoinRequest.update({
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

      return updated;
    });
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

    return this.prisma.organizationJoinRequest.update({
      where: { id: requestId },
      data: {
        status: JoinRequestStatus.REJECTED,
        message: reason?.trim() ? reason.trim() : request.message,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      },
    });
  }

  listMembers(organizationId: string) {
    return this.prisma.userOrganization.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
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

    return this.prisma.userOrganization.update({
      where: { id: membership.id },
      data: { role: newRole },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
  }

  listBranches(organizationId: string) {
    return this.prisma.branch.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  createBranch(organizationId: string, data: { name: string; timezone: string }) {
    if (!data.name?.trim()) throw new BadRequestException("Branch name is required");
    if (!data.timezone?.trim()) throw new BadRequestException("Timezone is required");

    return this.prisma.branch.create({
      data: {
        organizationId,
        name: data.name.trim(),
        timezone: data.timezone.trim(),
      },
    });
  }

  async updateBranch(
    branchId: string,
    organizationId: string,
    data: { name?: string; timezone?: string },
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException("Branch name is required");
    }
    if (data.timezone !== undefined && !data.timezone.trim()) {
      throw new BadRequestException("Timezone is required");
    }

    return this.prisma.branch.update({
      where: { id: branchId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone.trim() } : {}),
      },
    });
  }

  getBranch(branchId: string, organizationId: string) {
    return this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
  }
}

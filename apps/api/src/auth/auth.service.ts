import { Injectable, Logger } from "@nestjs/common";
import { JoinRequestStatus } from "@erp/types";
import type { AuthUserPayload, PropelAuthOrgMembership } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { TenantsService } from "../tenants/tenants.service";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
  ) {}

  async syncUser(claims: AuthUserPayload) {
    const name =
      [claims.firstName, claims.lastName].filter(Boolean).join(" ") || undefined;
    const email = claims.email ?? `${claims.userId}@unknown.local`;

    const user = await this.prisma.user.upsert({
      where: { propelAuthUserId: claims.userId },
      update: { email, name },
      create: {
        propelAuthUserId: claims.userId,
        email,
        name,
      },
    });

    await this.tenants.fulfillPendingInvitesForUser(user.id, email);

    const propelAuthOrgs = claims.orgs ?? [];
    if (propelAuthOrgs.length > 0) {
      await this.tenants.syncUserPropelAuthOrgMemberships(
        user.id,
        email,
        propelAuthOrgs,
      );
      await this.syncPropelAuthOrgUsers(propelAuthOrgs);
    }

    const membershipCount = await this.prisma.userOrganization.count({
      where: { userId: user.id },
    });

    const pendingJoinRequest = await this.prisma.organizationJoinRequest.findFirst({
      where: { userId: user.id, status: JoinRequestStatus.PENDING },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { memberships: { include: { organization: true } } },
    });

    return {
      user: fullUser,
      hasActiveMembership: membershipCount > 0,
      pendingJoinRequest: pendingJoinRequest
        ? {
            id: pendingJoinRequest.id,
            organizationId: pendingJoinRequest.organizationId,
            organizationName: pendingJoinRequest.organization.name,
            message: pendingJoinRequest.message,
            createdAt: pendingJoinRequest.createdAt,
          }
        : null,
    };
  }

  /** Upsert all members of linked PropelAuth orgs into the ERP users table. */
  private async syncPropelAuthOrgUsers(orgs: PropelAuthOrgMembership[]) {
    const seen = new Set<string>();
    for (const org of orgs) {
      if (seen.has(org.orgId)) continue;
      seen.add(org.orgId);
      try {
        await this.tenants.syncPropelAuthOrgUsersToDb(org.orgId);
      } catch (err) {
        this.logger.warn(
          `PropelAuth org user sync failed for ${org.orgId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }
}

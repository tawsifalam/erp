import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { initBaseAuth, type UserClass } from "@propelauth/node";
import { Role } from "@erp/types";
import type { AuthUserPayload } from "@erp/types";

type PropelAuthAdmin = ReturnType<typeof initBaseAuth>;

@Injectable()
export class PropelAuthService implements OnModuleInit {
  private validateAccessToken!: (
    authorizationHeader: string | undefined,
  ) => Promise<UserClass>;

  private admin!: PropelAuthAdmin;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const authUrl = this.config.getOrThrow<string>("PROPELAUTH_AUTH_URL");
    const apiKey = this.config.getOrThrow<string>("PROPELAUTH_API_KEY");
    const rawVerifierKey = this.config.get<string>("PROPELAUTH_VERIFIER_KEY");

    // .env stores the PEM as a single line with literal \n — convert to real newlines
    const verifierKey = rawVerifierKey?.includes("\\n")
      ? rawVerifierKey.replace(/\\n/g, "\n")
      : rawVerifierKey;

    const auth = initBaseAuth({
      authUrl,
      apiKey,
      ...(verifierKey
        ? {
            manualTokenVerificationMetadata: {
              verifierKey,
              issuer: authUrl,
            },
          }
        : {}),
    });

    this.admin = auth;
    this.validateAccessToken = auth.validateAccessTokenAndGetUserClass;
  }

  /** PropelAuth org role used for email invites (ERP RBAC remains authoritative). */
  defaultOrgInviteRole(): string {
    return this.config.get<string>("PROPELAUTH_ORG_MEMBER_ROLE") ?? "Member";
  }

  /** PropelAuth org role assigned to the user who creates an ERP organization. */
  defaultOrgOwnerRole(): string {
    return this.config.get<string>("PROPELAUTH_ORG_OWNER_ROLE") ?? "Owner";
  }

  /** PropelAuth org role used for ERP admins when syncing or updating PropelAuth. */
  defaultOrgAdminRole(): string {
    return this.config.get<string>("PROPELAUTH_ORG_ADMIN_ROLE") ?? "Admin";
  }

  /** Map PropelAuth org role names to ERP roles when importing members. */
  mapPropelAuthRoleToErp(propelAuthRole: string): Role {
    const normalized = propelAuthRole.trim().toLowerCase();
    if (normalized === this.defaultOrgOwnerRole().trim().toLowerCase()) {
      return Role.OWNER;
    }
    if (normalized === this.defaultOrgAdminRole().trim().toLowerCase()) {
      return Role.ADMIN;
    }
    if (normalized === this.defaultOrgInviteRole().trim().toLowerCase()) {
      return Role.FRONT_DESK;
    }
    return Role.FRONT_DESK;
  }

  /** Map ERP roles to PropelAuth org roles when pushing membership changes. */
  mapErpRoleToPropelAuth(erpRole: string): string {
    switch (erpRole) {
      case Role.OWNER:
        return this.defaultOrgOwnerRole();
      case Role.ADMIN:
        return this.defaultOrgAdminRole();
      default:
        return this.defaultOrgInviteRole();
    }
  }

  async fetchOrg(orgId: string) {
    return this.admin.fetchOrg(orgId);
  }

  async createOrg(name: string, legacyOrgId?: string) {
    return this.admin.createOrg({
      name,
      ...(legacyOrgId ? { legacyOrgId } : {}),
    });
  }

  async addUserToOrg(orgId: string, userId: string, role?: string) {
    return this.admin.addUserToOrg({
      orgId,
      userId,
      role: role ?? this.defaultOrgOwnerRole(),
    });
  }

  async removeUserFromOrg(orgId: string, userId: string) {
    return this.admin.removeUserFromOrg({ orgId, userId });
  }

  async updateOrg(orgId: string, name: string) {
    return this.admin.updateOrg({ orgId, name });
  }

  async inviteUserToOrg(orgId: string, email: string, role?: string) {
    return this.admin.inviteUserToOrg({
      orgId,
      email,
      role: role ?? this.defaultOrgInviteRole(),
    });
  }

  async revokePendingOrgInvite(orgId: string, email: string) {
    return this.admin.revokePendingOrgInvite({
      orgId,
      inviteeEmail: email,
    });
  }

  async fetchAllUsersInOrg(propelAuthOrgId: string) {
    const users: Awaited<
      ReturnType<PropelAuthAdmin["fetchUsersInOrg"]>
    >["users"] = [];
    let pageNumber = 0;
    let hasMore = true;

    while (hasMore) {
      const page = await this.admin.fetchUsersInOrg({
        orgId: propelAuthOrgId,
        pageSize: 100,
        pageNumber,
      });
      users.push(...page.users);
      hasMore = page.hasMoreResults;
      pageNumber += 1;
    }

    return users;
  }

  async validateAuthorizationHeader(
    authorizationHeader: string | undefined,
  ): Promise<AuthUserPayload> {
    const user = await this.validateAccessToken(authorizationHeader);
    const orgs = user.getOrgs().map((org) => ({
      orgId: org.orgId,
      orgName: org.orgName,
      role: org.assignedRole,
    }));
    return {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      orgId: orgs[0]?.orgId,
      orgs,
    };
  }
}

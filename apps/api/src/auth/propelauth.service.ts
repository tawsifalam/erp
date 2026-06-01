import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { initBaseAuth, type UserClass } from "@propelauth/node";
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

  async fetchOrg(orgId: string) {
    return this.admin.fetchOrg(orgId);
  }

  async createOrg(name: string, legacyOrgId?: string) {
    return this.admin.createOrg({
      name,
      ...(legacyOrgId ? { legacyOrgId } : {}),
    });
  }

  async inviteUserToOrg(orgId: string, email: string) {
    return this.admin.inviteUserToOrg({
      orgId,
      email,
      role: this.defaultOrgInviteRole(),
    });
  }

  async revokePendingOrgInvite(orgId: string, email: string) {
    return this.admin.revokePendingOrgInvite({
      orgId,
      inviteeEmail: email,
    });
  }

  async validateAuthorizationHeader(
    authorizationHeader: string | undefined,
  ): Promise<AuthUserPayload> {
    const user = await this.validateAccessToken(authorizationHeader);
    const org = user.getOrgs()[0];
    return {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      orgId: org?.orgId,
    };
  }
}

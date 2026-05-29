import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { initBaseAuth, type UserClass } from "@propelauth/node";
import type { AuthUserPayload } from "@erp/types";

@Injectable()
export class PropelAuthService implements OnModuleInit {
  private validateAccessToken!: (
    authorizationHeader: string | undefined,
  ) => Promise<UserClass>;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const authUrl = this.config.getOrThrow<string>("PROPELAUTH_AUTH_URL");
    const apiKey = this.config.getOrThrow<string>("PROPELAUTH_API_KEY");
    const verifierKey = this.config.get<string>("PROPELAUTH_VERIFIER_KEY");

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

    this.validateAccessToken = auth.validateAccessTokenAndGetUserClass;
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

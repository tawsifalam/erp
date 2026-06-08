import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SignJWT, jwtVerify } from "jose";
import type { AuthUserPayload } from "@erp/types";

export type AccessTokenClaims = AuthUserPayload;

@Injectable()
export class TokenService {
  private readonly accessSecret: Uint8Array;
  private readonly inviteSecret: Uint8Array;
  private readonly resetSecret: Uint8Array;

  constructor(private readonly config: ConfigService) {
    const access = this.config.getOrThrow<string>("JWT_ACCESS_SECRET");
    const refresh = this.config.getOrThrow<string>("JWT_REFRESH_SECRET");
    this.accessSecret = new TextEncoder().encode(access);
    this.inviteSecret = new TextEncoder().encode(`${refresh}:invite`);
    this.resetSecret = new TextEncoder().encode(`${refresh}:reset`);
  }

  private accessTtlSeconds(): number {
    const raw = this.config.get<string>("JWT_ACCESS_TTL", "15m");
    return parseDurationSeconds(raw, 15 * 60);
  }

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ ...claims })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.userId)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtlSeconds()}s`)
      .sign(this.accessSecret);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.accessSecret);
    const userId = payload.sub ?? (payload.userId as string);
    if (!userId) throw new Error("Invalid token payload");
    return {
      userId,
      email: payload.email as string | undefined,
      firstName: payload.firstName as string | undefined,
      lastName: payload.lastName as string | undefined,
    };
  }

  async signInviteToken(payload: {
    inviteId: string;
    organizationId: string;
    email: string;
  }): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(this.inviteSecret);
  }

  async verifyInviteToken(token: string): Promise<{
    inviteId: string;
    organizationId: string;
    email: string;
  }> {
    const { payload } = await jwtVerify(token, this.inviteSecret);
    const inviteId = payload.inviteId as string;
    const organizationId = payload.organizationId as string;
    const email = payload.email as string;
    if (!inviteId || !organizationId || !email) throw new Error("Invalid invite token");
    return { inviteId, organizationId, email };
  }

  async signPasswordResetToken(userId: string, email: string): Promise<string> {
    return new SignJWT({ userId, email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(this.resetSecret);
  }

  async verifyPasswordResetToken(token: string): Promise<{ userId: string; email: string }> {
    const { payload } = await jwtVerify(token, this.resetSecret);
    const userId = payload.userId as string;
    const email = payload.email as string;
    if (!userId || !email) throw new Error("Invalid reset token");
    return { userId, email };
  }
}

function parseDurationSeconds(raw: string, fallback: number): number {
  const m = raw.match(/^(\d+)([smhd])$/);
  if (!m) return fallback;
  const n = Number(m[1]);
  switch (m[2]) {
    case "s":
      return n;
    case "m":
      return n * 60;
    case "h":
      return n * 3600;
    case "d":
      return n * 86400;
    default:
      return fallback;
  }
}

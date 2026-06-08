import { ConfigService } from "@nestjs/config";
import { TokenService } from "./token.service";

function mockConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    JWT_ACCESS_SECRET: "test-access-secret-16ch",
    JWT_REFRESH_SECRET: "test-refresh-secret-16ch",
    JWT_ACCESS_TTL: "15m",
    ...overrides,
  };
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
    getOrThrow: (key: string) => {
      const v = values[key];
      if (v === undefined) throw new Error(`Missing config: ${key}`);
      return v;
    },
  } as ConfigService;
}

describe("TokenService", () => {
  let service: TokenService;

  beforeEach(() => {
    service = new TokenService(mockConfig());
  });

  it("signs and verifies access tokens", async () => {
    const token = await service.signAccessToken({
      userId: "usr_1",
      email: "user@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
    });
    const claims = await service.verifyAccessToken(token);
    expect(claims.userId).toBe("usr_1");
    expect(claims.email).toBe("user@example.com");
    expect(claims.firstName).toBe("Ada");
    expect(claims.lastName).toBe("Lovelace");
  });

  it("signs and verifies invite tokens", async () => {
    const token = await service.signInviteToken({
      inviteId: "inv_1",
      organizationId: "org_1",
      email: "invite@example.com",
    });
    const claims = await service.verifyInviteToken(token);
    expect(claims).toEqual({
      inviteId: "inv_1",
      organizationId: "org_1",
      email: "invite@example.com",
    });
  });

  it("signs and verifies password reset tokens", async () => {
    const token = await service.signPasswordResetToken("usr_1", "user@example.com");
    const claims = await service.verifyPasswordResetToken(token);
    expect(claims).toEqual({ userId: "usr_1", email: "user@example.com" });
  });

  it("rejects invite tokens missing required claims", async () => {
    await expect(service.verifyInviteToken("not-a-jwt")).rejects.toThrow("Invalid invite token");
  });
});

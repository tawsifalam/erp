import { ConfigService } from "@nestjs/config";

const redisStore = new Map<string, string>();
const mockRedis = {
  set: jest.fn(async (key: string, value: string) => {
    redisStore.set(key, value);
    return "OK";
  }),
  get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
  del: jest.fn(async (...keys: string[]) => {
    let removed = 0;
    for (const key of keys) {
      if (redisStore.delete(key)) removed += 1;
    }
    return removed;
  }),
  scan: jest.fn(async (cursor: string) => {
    const keys = [...redisStore.keys()].filter((k) => k.startsWith("auth:refresh:"));
    if (cursor === "0" && keys.length > 0) {
      return ["0", keys] as [string, string[]];
    }
    return ["0", []] as [string, string[]];
  }),
  quit: jest.fn(async () => "OK"),
};

jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockRedis),
}));

import { SessionService } from "./session.service";

function mockConfig() {
  return {
    get: (key: string, fallback?: string) => {
      if (key === "JWT_REFRESH_TTL") return "30d";
      return fallback;
    },
    getOrThrow: (key: string) => {
      if (key === "REDIS_URL") return "redis://localhost:6379";
      throw new Error(`Missing config: ${key}`);
    },
  } as ConfigService;
}

describe("SessionService", () => {
  let service: SessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    redisStore.clear();
    service = new SessionService(mockConfig());
  });

  it("stores and validates refresh tokens", async () => {
    const token = service.createRefreshToken();
    await service.storeRefreshToken(token, "usr_1", { userAgent: "jest", ip: "127.0.0.1" });

    const session = await service.validateRefreshToken(token);
    expect(session).toEqual({ userId: "usr_1", userAgent: "jest", ip: "127.0.0.1" });
  });

  it("revokes a refresh token", async () => {
    const token = service.createRefreshToken();
    await service.storeRefreshToken(token, "usr_1");
    await service.revokeRefreshToken(token);
    expect(await service.validateRefreshToken(token)).toBeNull();
  });

  it("rotates refresh tokens", async () => {
    const oldToken = service.createRefreshToken();
    const newToken = service.createRefreshToken();
    await service.storeRefreshToken(oldToken, "usr_1");
    await service.rotateRefreshToken(oldToken, newToken, "usr_1");

    expect(await service.validateRefreshToken(oldToken)).toBeNull();
    expect(await service.validateRefreshToken(newToken)).toEqual({ userId: "usr_1" });
  });

  it("revokes all sessions for a user", async () => {
    const tokenA = service.createRefreshToken();
    const tokenB = service.createRefreshToken();
    const otherToken = service.createRefreshToken();
    await service.storeRefreshToken(tokenA, "usr_1");
    await service.storeRefreshToken(tokenB, "usr_1");
    await service.storeRefreshToken(otherToken, "usr_2");

    await service.revokeAllForUser("usr_1");

    expect(await service.validateRefreshToken(tokenA)).toBeNull();
    expect(await service.validateRefreshToken(tokenB)).toBeNull();
    expect(await service.validateRefreshToken(otherToken)).toEqual({ userId: "usr_2" });
  });
});

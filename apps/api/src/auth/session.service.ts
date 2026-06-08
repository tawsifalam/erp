import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import Redis from "ioredis";

@Injectable()
export class SessionService {
  private readonly redis: Redis;
  private readonly refreshTtlSeconds: number;

  constructor(private readonly config: ConfigService) {
    const url = this.config.getOrThrow<string>("REDIS_URL");
    this.redis = new Redis(url, { maxRetriesPerRequest: null });
    this.refreshTtlSeconds = parseDurationSeconds(
      this.config.get<string>("JWT_REFRESH_TTL", "30d"),
      30 * 86400,
    );
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  createRefreshToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private key(tokenHash: string): string {
    return `auth:refresh:${tokenHash}`;
  }

  async storeRefreshToken(
    token: string,
    userId: string,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<void> {
    const tokenHash = this.hashToken(token);
    await this.redis.set(
      this.key(tokenHash),
      JSON.stringify({ userId, userAgent: meta?.userAgent, ip: meta?.ip }),
      "EX",
      this.refreshTtlSeconds,
    );
  }

  async validateRefreshToken(
    token: string,
  ): Promise<{ userId: string; userAgent?: string; ip?: string } | null> {
    const tokenHash = this.hashToken(token);
    const raw = await this.redis.get(this.key(tokenHash));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { userId: string; userAgent?: string; ip?: string };
    } catch {
      return null;
    }
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await this.redis.del(this.key(tokenHash));
  }

  async rotateRefreshToken(
    oldToken: string,
    newToken: string,
    userId: string,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<void> {
    await this.revokeRefreshToken(oldToken);
    await this.storeRefreshToken(newToken, userId, meta);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    let cursor = "0";
    do {
      const [next, keys] = await this.redis.scan(cursor, "MATCH", "auth:refresh:*", "COUNT", 100);
      cursor = next;
      for (const key of keys) {
        const raw = await this.redis.get(key);
        if (!raw) continue;
        try {
          const data = JSON.parse(raw) as { userId?: string };
          if (data.userId === userId) await this.redis.del(key);
        } catch {
          // ignore malformed session payload
        }
      }
    } while (cursor !== "0");
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

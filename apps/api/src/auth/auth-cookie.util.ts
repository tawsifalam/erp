import type { Response } from "express";
import type { ConfigService } from "@nestjs/config";

export function setRefreshCookie(
  res: Response,
  config: ConfigService,
  token: string,
): void {
  const name = config.get<string>("AUTH_COOKIE_NAME", "erp_refresh");
  const secure = config.get<string>("NODE_ENV") === "production";
  const maxAge = refreshMaxAgeMs(config);
  res.cookie(name, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export function clearRefreshCookie(res: Response, config: ConfigService): void {
  const name = config.get<string>("AUTH_COOKIE_NAME", "erp_refresh");
  res.clearCookie(name, { path: "/" });
}

export function readRefreshCookie(
  cookies: Record<string, string | undefined>,
  config: ConfigService,
): string | undefined {
  const name = config.get<string>("AUTH_COOKIE_NAME", "erp_refresh");
  return cookies[name];
}

function refreshMaxAgeMs(config: ConfigService): number {
  const raw = config.get<string>("JWT_REFRESH_TTL", "30d");
  const m = raw.match(/^(\d+)([smhd])$/);
  if (!m) return 30 * 86400 * 1000;
  const n = Number(m[1]);
  const mult =
    m[2] === "s" ? 1000 : m[2] === "m" ? 60_000 : m[2] === "h" ? 3_600_000 : 86_400_000;
  return n * mult;
}

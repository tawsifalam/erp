import type { APIRequestContext } from "@playwright/test";

/** Direct Nest API URL for smoke-local (not the Next.js proxy). */
export const smokeApiBase =
  process.env.SMOKE_API_URL ??
  process.env.API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

export type SmokeApiSession = {
  accessToken: string;
  refreshToken: string | null;
  userId: string;
  email: string;
};

function parseRefreshCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const name = process.env.AUTH_COOKIE_NAME ?? "erp_refresh";
  for (const part of setCookie.split(/,(?=\s*\w+=)/)) {
    const [pair] = part.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() === name) {
      return pair.slice(eq + 1).trim();
    }
  }
  return null;
}

export async function smokeApiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<SmokeApiSession> {
  const res = await request.post(`${smokeApiBase}/api/auth/login`, {
    data: { email, password },
  });
  if (!res.ok()) {
    throw new Error(`Login failed (${res.status()}): ${await res.text()}`);
  }
  const body = (await res.json()) as {
    accessToken: string;
    user: { id: string; email: string };
  };
  const setCookie = res.headers()["set-cookie"] ?? null;
  return {
    accessToken: body.accessToken,
    refreshToken: parseRefreshCookie(setCookie),
    userId: body.user.id,
    email: body.user.email,
  };
}

export async function smokeApiInviteMember(
  request: APIRequestContext,
  session: SmokeApiSession,
  organizationId: string,
  email: string,
  role: string,
): Promise<{ id: string; email: string; organizationId: string }> {
  const res = await request.post(`${smokeApiBase}/api/tenants/invites`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "X-Organization-Id": organizationId,
    },
    data: { email, role },
  });
  if (!res.ok()) {
    throw new Error(`Invite failed (${res.status()}): ${await res.text()}`);
  }
  return res.json();
}

export async function smokeApiListOrganizations(
  request: APIRequestContext,
  session: SmokeApiSession,
): Promise<
  Array<{
    organizationId: string;
    role: string;
    organization: { id: string; name: string };
  }>
> {
  const res = await request.get(`${smokeApiBase}/api/tenants/organizations`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (!res.ok()) {
    throw new Error(`List orgs failed (${res.status()}): ${await res.text()}`);
  }
  return res.json();
}

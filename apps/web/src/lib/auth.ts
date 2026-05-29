"use client";

/** Redirect to PropelAuth hosted login (handled by /api/auth/login). */
export function signIn() {
  window.location.href = "/api/auth/login";
}

/** Redirect to PropelAuth logout (handled by /api/auth/logout). */
export function signOut() {
  window.location.href = "/api/auth/logout";
}

/** Access token for API calls to NestJS (PropelAuth session route). */
export async function getAccessToken(): Promise<string | null> {
  const res = await fetch("/api/auth/access_token");
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

/** Sync PropelAuth user into local ERP database after login. */
export async function syncUserAfterLogin(orgId?: string) {
  const token = await getAccessToken();
  if (!token) return;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  await fetch(`${apiUrl}/api/auth/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(orgId ? { "X-Organization-Id": orgId } : {}),
    },
    body: JSON.stringify({ orgId }),
  });
}

"use client";

/** Redirect to PropelAuth hosted login (handled by /api/auth/login). */
export function signIn() {
  window.location.href = "/api/auth/login";
}

/** Redirect to PropelAuth hosted signup (handled by /api/auth/signup). */
export function signUp() {
  window.location.href = "/api/auth/signup";
}

/** Calls PropelAuth logout (POST clears session + invalidates token), then redirects. */
export async function signOut() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "/auth/login";
}

/**
 * Fetches the current access token from the PropelAuth session.
 * Uses the /api/auth/userinfo endpoint which is handled by the PropelAuth SDK route handler.
 */
export async function getAccessToken(): Promise<string | null> {
  const res = await fetch("/api/auth/userinfo", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken?: string };
  return data.accessToken ?? null;
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

"use client";

import {
  clearCachedAccessToken,
  getCachedAccessToken,
} from "./auth-token-store";

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
  clearCachedAccessToken();
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "/auth/login";
}

/**
 * Returns the access token from PropelAuth AuthProvider (via AuthTokenSync).
 * Does not call /api/auth/userinfo — AuthProvider refreshes that once centrally.
 */
export async function getAccessToken(): Promise<string | null> {
  const token = getCachedAccessToken();
  return token ?? null;
}

/** Sync PropelAuth user into local ERP database after login. */
export async function syncUserAfterLogin(orgId?: string, token?: string | null) {
  const accessToken = token ?? (await getAccessToken());
  if (!accessToken) return;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  await fetch(`${apiUrl}/api/auth/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(orgId ? { "X-Organization-Id": orgId } : {}),
    },
    body: JSON.stringify({ orgId }),
  });
}

"use client";

import {
  clearCachedAccessToken,
  getCachedAccessToken,
} from "./auth-token-store";
import { getApiBaseUrl } from "./api-base-url";

/** Redirect to login page. */
export function signIn() {
  window.location.href = "/auth/login";
}

/** Redirect to register page. */
export function signUp() {
  window.location.href = "/auth/register";
}

/** Logout via API and redirect to login. */
export async function signOut() {
  clearCachedAccessToken();
  document.cookie = "erp_session=; path=/; max-age=0";
  await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "/auth/login";
}

export async function getAccessToken(): Promise<string | null> {
  const token = getCachedAccessToken();
  return token ?? null;
}

/** Sync ERP user state after login. */
export async function syncUserAfterLogin(orgId?: string, token?: string | null) {
  const accessToken = token ?? (await getAccessToken());
  if (!accessToken) return;

  await fetch(`${getApiBaseUrl()}/api/auth/sync`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(orgId ? { "X-Organization-Id": orgId } : {}),
    },
    body: JSON.stringify({ orgId }),
  });
}

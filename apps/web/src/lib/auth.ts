"use client";

import {
  clearCachedAccessToken,
  getCachedAccessToken,
  setCachedAccessToken,
} from "./auth-token-store";
import { refreshApi } from "./auth-api";
import { getApiBaseUrl } from "./api-base-url";

const SESSION_COOKIE = "erp_session";

function setBrowserSessionFlag(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) {
    document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Lax`;
  } else {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
  }
}

let refreshInFlight: Promise<string | null> | null = null;

/** Refresh access token from httpOnly cookie; updates in-memory cache for apiFetch. */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const data = await refreshApi();
      if (data.accessToken) {
        setCachedAccessToken(data.accessToken);
        setBrowserSessionFlag(true);
        return data.accessToken;
      }
      setCachedAccessToken(null);
      setBrowserSessionFlag(false);
      return null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

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

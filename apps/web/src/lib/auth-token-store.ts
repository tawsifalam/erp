/** In-memory access token synced from @propelauth/nextjs AuthProvider (useUser). */
let accessToken: string | null | undefined;

declare global {
  interface Window {
    /** Set by Playwright E2E setup only — never in production builds. */
    __ERP_E2E_ACCESS_TOKEN__?: string;
  }
}

export function setCachedAccessToken(token: string | null | undefined) {
  accessToken = token;
}

export function getCachedAccessToken(): string | null | undefined {
  if (typeof window !== "undefined" && window.__ERP_E2E_ACCESS_TOKEN__) {
    return window.__ERP_E2E_ACCESS_TOKEN__;
  }
  return accessToken;
}

export function clearCachedAccessToken() {
  accessToken = undefined;
}

/** In-memory access token synced from @propelauth/nextjs AuthProvider (useUser). */
let accessToken: string | null | undefined;

export function setCachedAccessToken(token: string | null | undefined) {
  accessToken = token;
}

export function getCachedAccessToken(): string | null | undefined {
  return accessToken;
}

export function clearCachedAccessToken() {
  accessToken = undefined;
}

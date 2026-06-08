/**
 * API base URL for browser fetches. In local dev, use the web origin (port 3000)
 * so Next.js rewrites proxy /api to Nest and auth cookies stay same-origin.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_URL ??
    "http://localhost:3001"
  );
}

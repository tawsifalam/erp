import { NextResponse, type NextRequest } from "next/server";
import { authMiddleware } from "@propelauth/nextjs/server/app-router";

const PUBLIC_PATHS = ["/auth/login", "/auth/signup", "/api/auth/"];
const ONBOARDING_PATHS = ["/onboarding"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isOnboarding = ONBOARDING_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic || isOnboarding || pathname === "/") {
    return authMiddleware(req);
  }

  // Run PropelAuth middleware to refresh tokens / attach headers
  const res = await authMiddleware(req);

  // Check if user has a valid session (access token cookie exists)
  const hasSession = req.cookies.has("__pa_at");
  if (!hasSession) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

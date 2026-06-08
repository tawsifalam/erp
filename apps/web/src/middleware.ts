import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/accept-invite",
];
const ONBOARDING_PATHS = ["/onboarding"];
const REFRESH_COOKIE = "erp_refresh";
const SESSION_COOKIE = "erp_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isOnboarding = ONBOARDING_PATHS.some((p) => pathname.startsWith(p));
  const hasRefresh =
    req.cookies.has(REFRESH_COOKIE) || req.cookies.has(SESSION_COOKIE);

  if (isPublic || isOnboarding || pathname === "/") {
    return NextResponse.next();
  }

  if (!hasRefresh) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("return_to", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};

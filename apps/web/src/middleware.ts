import { authMiddleware } from "@propelauth/nextjs/server/app-router";

export const middleware = authMiddleware;

export const config = {
  matcher: ["/api/auth/(.*)", "/((?!_next/static|_next/image|favicon.ico).*)"],
};

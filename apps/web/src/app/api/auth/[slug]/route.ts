import { getRouteHandlers } from "@propelauth/nextjs/server/app-router";
import type { NextRequest } from "next/server";

const routeHandlers = getRouteHandlers({
  postLoginRedirectPathFn: (_req: NextRequest) => "/dashboard",
});

export const GET = routeHandlers.getRouteHandlerAsync;
export const POST = routeHandlers.postRouteHandlerAsync;

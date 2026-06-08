import type { Page } from "@playwright/test";
import {
  APPLICANT_EMAIL,
  APPLICANT_USER_ID,
  getOnboardingStatus,
  handleJoinRequestMutation,
  lookupOrgByJoinCode,
} from "./join-request-state";
import { isBackendApiUrl } from "./auth";

function fulfillJson(route: import("@playwright/test").Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/** API mocks for a user with no org membership (join-code flow). */
export async function mockAuthApplicant(page: Page) {
  await page.route(
    (url) => isBackendApiUrl(url.href) && url.pathname.endsWith("/api/auth/refresh"),
    (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "mock-applicant-token",
          user: { id: APPLICANT_USER_ID, email: APPLICANT_EMAIL, name: null },
        }),
      });
    },
  );

  await page.route("**/api/auth/sync", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hasActiveMembership: false, pendingJoinRequest: null }),
    }),
  );

  await page.context().addInitScript((token) => {
    window.__ERP_E2E_ACCESS_TOKEN__ = token;
  }, "mock-applicant-token");

  await page.context().addCookies([
    {
      name: "erp_refresh",
      value: "mock-applicant-refresh",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** Minimal backend routes for onboarding join-code (no full ERP shell). */
export async function mockApplicantApiRoutes(page: Page) {
  await page.route((url) => isBackendApiUrl(url.href), async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;

    if (url.includes("/tenants/onboarding/status") && method === "GET") {
      return fulfillJson(route, getOnboardingStatus(APPLICANT_USER_ID));
    }

    if (url.includes("/tenants/organizations") && method === "GET" && !url.includes("by-join-code")) {
      return fulfillJson(route, []);
    }

    const joinResult = handleJoinRequestMutation(method, url, body, APPLICANT_USER_ID);
    if (joinResult !== null) {
      if (
        typeof joinResult === "object" &&
        joinResult !== null &&
        "status" in joinResult &&
        typeof (joinResult as { status: number }).status === "number" &&
        (joinResult as { status: number }).status >= 400
      ) {
        const err = joinResult as { status: number; message: string };
        return route.fulfill({
          status: err.status,
          contentType: "application/json",
          body: JSON.stringify({ message: err.message }),
        });
      }
      return fulfillJson(route, joinResult);
    }

    if (url.includes("/tenants/organizations/by-join-code/") && method === "GET") {
      const code = decodeURIComponent(url.split("/by-join-code/")[1]?.split("?")[0] ?? "");
      return fulfillJson(route, lookupOrgByJoinCode(code));
    }

    if (url.includes("/api/auth/")) {
      return route.fallback();
    }

    return route.fallback();
  });
}

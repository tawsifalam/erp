import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { SMOKE_SEED_BRANCH_ID, SMOKE_SEED_ORG_ID, SMOKE_AUTH_FILE } from "./smoke-constants";

export type SmokeAuth = {
  accessToken: string;
  organizationId: string;
  branchId: string;
  propelAuthUserId: string;
};

export function smokeAuthPath() {
  return path.join(__dirname, "..", "..", "..", "..", SMOKE_AUTH_FILE);
}

export async function loadSmokeAuth(): Promise<SmokeAuth> {
  try {
    const raw = await readFile(smokeAuthPath(), "utf8");
    return JSON.parse(raw) as SmokeAuth;
  } catch {
    throw new Error(
      `Missing ${SMOKE_AUTH_FILE}. Run: pnpm smoke:local:setup (see docs/smoke-local.md)`,
    );
  }
}

/**
 * Real stack: PropelAuth token + seed tenant, no API mocks.
 * Mocks only PropelAuth hosted/session endpoints so Next middleware passes.
 */
export async function setupRealStackPage(page: Page, auth: SmokeAuth) {
  const { accessToken, organizationId, branchId } = auth;

  await page.route(/propelauth\.com/i, async (route) => {
    const url = route.request().url();
    if (
      url.includes("/api/v1/refresh_token") ||
      url.includes("/api/be/v1/") ||
      url.includes("/api/v1/whoami")
    ) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: accessToken,
          user_id: auth.propelAuthUserId,
          email: process.env.SMOKE_PROPELAUTH_USER_EMAIL ?? "smoke@example.com",
        }),
      });
    }
    return route.fulfill({ status: 200, body: "{}" });
  });

  await page.route("**/api/auth/userinfo", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        userinfo: { user_id: auth.propelAuthUserId },
        accessToken,
      }),
    }),
  );

  await page.context().addCookies([
    {
      name: "__pa_at",
      value: accessToken,
      domain: "localhost",
      path: "/",
    },
  ]);

  await page.addInitScript(
    ({ token, orgId, branchId: brId }) => {
      window.__ERP_E2E_ACCESS_TOKEN__ = token;
      localStorage.setItem(
        "erp:tenant",
        JSON.stringify({ organizationId: orgId, branchId: brId }),
      );
    },
    { token: accessToken, orgId: organizationId, branchId },
  );
}

export async function gotoAppRealStack(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .waitFor({ state: "visible", timeout: 30_000 });
}

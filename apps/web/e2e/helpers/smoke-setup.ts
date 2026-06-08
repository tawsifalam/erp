import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import {
  SMOKE_AUTH_FILE,
  SMOKE_TIMEOUT,
} from "./smoke-constants";

export type SmokeFrontDeskAuth = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  /** Branch with an active UserBranch grant for this user. */
  grantedBranchId: string;
  /** Same-org branch without a grant — requests should return 403. */
  deniedBranchId: string;
};

export type SmokeAuth = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  organizationId: string;
  branchId: string;
  /** Present when SMOKE_FRONT_DESK_USER_EMAIL is set during setup. */
  frontDeskAuth?: SmokeFrontDeskAuth;
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
 * Real stack: JWT session from setup + seed tenant, no API mocks.
 * Sets refresh cookie so Next.js middleware passes; AuthProvider uses refresh API.
 */
export async function setupRealStackPage(page: Page, auth: SmokeAuth) {
  const { accessToken, refreshToken, organizationId, branchId, userId, email } = auth;

  await page.route("**/api/auth/refresh", (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken,
        user: { id: userId, email, name: null },
      }),
    });
  });

  await page.context().addCookies([
    {
      name: process.env.AUTH_COOKIE_NAME ?? "erp_refresh",
      value: refreshToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
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

/** Select seed org/branch in the header when another membership is active. */
export async function ensureSeedTenant(page: Page, auth: SmokeAuth) {
  await page.getByTestId("tenant-selector").waitFor({ state: "visible", timeout: SMOKE_TIMEOUT });

  const orgSelect = page.locator('select[aria-label="Organization"]');
  await orgSelect.locator(`option[value="${auth.organizationId}"]`).waitFor({
    state: "attached",
    timeout: SMOKE_TIMEOUT,
  });

  const orgId = await orgSelect.inputValue();
  if (orgId !== auth.organizationId) {
    await orgSelect.selectOption({ value: auth.organizationId }, { force: true, timeout: SMOKE_TIMEOUT });
    await orgSelect.dispatchEvent("change");
  }

  const branchSelect = page.locator('select[aria-label="Branch"]');
  await branchSelect.locator(`option[value="${auth.branchId}"]`).waitFor({
    state: "attached",
    timeout: SMOKE_TIMEOUT,
  });
  const branchId = await branchSelect.inputValue();
  if (branchId !== auth.branchId) {
    await branchSelect.selectOption({ value: auth.branchId }, { force: true, timeout: SMOKE_TIMEOUT });
    await branchSelect.dispatchEvent("change");
  }
}

export async function gotoAppRealStack(page: Page, path: string, auth?: SmokeAuth) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .waitFor({ state: "visible", timeout: SMOKE_TIMEOUT });
  if (auth) {
    await ensureSeedTenant(page, auth);
  }
}

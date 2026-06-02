import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  gotoAppRealStack,
  loadSmokeAuth,
  setupRealStackPage,
  type SmokeAuth,
} from "./smoke-setup";

export const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Unique suffix per run to avoid duplicate names in the DB. */
export function smokeSuffix() {
  return String(Date.now()).slice(-8);
}

let sharedAuth: SmokeAuth | undefined;

export function useSmokeHarness() {
  test.describe.configure({ mode: "serial" });

  test.skip(
    () => !!process.env.CI && !process.env.SMOKE_PROPELAUTH_USER_ID,
    "CI runs mocked e2e only; set secrets to enable smoke-local in CI",
  );

  test.beforeAll(async () => {
    sharedAuth = await loadSmokeAuth();
  });

  test.beforeEach(async ({ page }) => {
    if (!sharedAuth) sharedAuth = await loadSmokeAuth();
    await setupRealStackPage(page, sharedAuth);
  });

  return {
    get auth() {
      if (!sharedAuth) throw new Error("Smoke auth not loaded");
      return sharedAuth;
    },
    goto: gotoAppRealStack,
    expect,
  };
}

export async function openPmsTab(page: Page, tab: string | RegExp) {
  await gotoAppRealStack(page, "/pms");
  await page.getByRole("tab", { name: tab }).click();
}

export async function ensureProcurementVendor(page: Page, name = "Fresh Foods Ltd") {
  await gotoAppRealStack(page, "/procurement");
  const vendorsPanel = page.getByRole("tabpanel", { name: "Vendors" });
  const vendorCells = vendorsPanel.getByRole("cell", { name });
  if ((await vendorCells.count()) === 0) {
    await vendorsPanel.getByRole("button", { name: "+ Add vendor" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Contact").fill("Rashid");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(vendorCells.first()).toBeVisible({ timeout: 15_000 });
  }
}

export function selectReportType(page: Page, value: string) {
  return page.locator("select").filter({
    has: page.locator(`option[value="${value}"]`),
  });
}

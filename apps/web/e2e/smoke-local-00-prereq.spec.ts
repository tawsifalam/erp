/**
 * Smoke prerequisites (runbook P0–P8 subset).
 */
import { test } from "@playwright/test";
import {
  apiBase,
  SMOKE_SEED_BRANCH_NAME,
  SMOKE_SEED_ORG_NAME,
  useSmokeHarness,
} from "./helpers/smoke-local.harness";

const { goto, expect } = useSmokeHarness();

const SEED_COA_CODES = ["1000", "1100", "2000", "4000", "5100", "2100"] as const;

test.describe("Smoke — prerequisites", () => {
  test("P0 — API health", async ({ request }) => {
    const res = await request.get(`${apiBase}/api/health`);
    expect(res.ok()).toBeTruthy();
  });

  test("P3 — seed tenant selected in header", async ({ page }) => {
    await goto(page, "/dashboard");
    const tenant = page.getByTestId("tenant-selector");
    await expect(tenant.getByRole("combobox").first()).toContainText(SMOKE_SEED_ORG_NAME);
    await expect(tenant.getByRole("combobox").nth(1)).toContainText(SMOKE_SEED_BRANCH_NAME);
  });

  test("P1 — dashboard Overview and KPIs", async ({ page }) => {
    await goto(page, "/dashboard");
    await expect(page.getByRole("heading", { name: /Overview/i })).toBeVisible();
    await expect(page.getByText("Occupancy", { exact: true })).toBeVisible();
    await expect(page.getByText("Active reservations", { exact: true })).toBeVisible();
  });

  test("P7 — chart of accounts seed codes", async ({ page }) => {
    await goto(page, "/accounting");
    await page.getByRole("tab", { name: /Chart of accounts/i }).click();
    for (const code of SEED_COA_CODES) {
      await expect(page.getByRole("cell", { name: code, exact: true })).toBeVisible();
    }
  });

  test("P8 — default inventory pools", async ({ page }) => {
    await goto(page, "/settings?tab=pools");
    const poolsPanel = page.getByRole("tabpanel", { name: "Inventory pools" });
    await expect(poolsPanel.getByRole("cell", { name: "guest(system)" })).toBeVisible();
    await expect(poolsPanel.getByRole("cell", { name: "staff(system)" })).toBeVisible();
  });

  test("P2 — module routes load (sidebar)", async ({ page }) => {
    const routes: { path: string; heading: RegExp }[] = [
      { path: "/pms", heading: /^Property management$/i },
      { path: "/pos", heading: /^Point of sale$/i },
      { path: "/inventory", heading: /^Stock management$/i },
      { path: "/procurement", heading: /^Procurement$/i },
      { path: "/accounting", heading: /^Accounting$/i },
      { path: "/hr", heading: /^Human resources$/i },
      { path: "/reports", heading: /^Reports & exports$/i },
      { path: "/settings", heading: /^Organization settings$/i },
    ];
    for (const { path, heading } of routes) {
      await goto(page, path);
      await expect(page.getByRole("heading", { name: heading, level: 2 })).toBeVisible();
    }
  });
});

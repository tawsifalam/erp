/**
 * Smoke prerequisites (runbook P1–P8 subset).
 */
import { test } from "@playwright/test";
import { apiBase, useSmokeHarness } from "./helpers/smoke-local.harness";

const { goto, expect } = useSmokeHarness();

test.describe("Smoke — prerequisites", () => {
  test("P0 — API health", async ({ request }) => {
    const res = await request.get(`${apiBase}/api/health`);
    expect(res.ok()).toBeTruthy();
  });

  test("P1 — dashboard Overview and KPIs", async ({ page }) => {
    await goto(page, "/dashboard");
    await expect(page.getByRole("heading", { name: /Overview/i })).toBeVisible();
    await expect(page.getByText("Occupancy", { exact: true })).toBeVisible();
    await expect(page.getByText("Active reservations", { exact: true })).toBeVisible();
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
      await expect(page.getByRole("heading", { name: heading, level: 2 })).toBeVisible({
        timeout: 15_000,
      });
    }
  });
});

import { test, expect } from "@playwright/test";
import {
  mockAuth,
  mockApiRoutes,
  FAKE_ORG_ID,
  FAKE_ORG_ID_2,
  FAKE_BRANCH_ID,
  FAKE_BRANCH_ID_2,
  FAKE_BRANCH_ID_2B,
} from "./helpers/auth";

test.describe("Organization & branch selection", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
    await page.goto("/dashboard");
    await expect(page.getByTestId("tenant-selector")).toBeVisible();
  });

  test("shows organization and branch dropdowns with seed data", async ({ page }) => {
    const orgSelect = page.getByTestId("tenant-org-select");
    const branchSelect = page.getByTestId("tenant-branch-select");

    await expect(orgSelect).toBeVisible();
    await expect(branchSelect).toBeVisible();
    await expect(orgSelect.locator("option")).toHaveCount(2);
    await expect(branchSelect.locator("option", { hasText: "Main Branch" })).toBeVisible();
    await expect(branchSelect.locator("option", { hasText: "Annex Branch" })).toBeVisible();
  });

  test("defaults to first org and first branch metrics", async ({ page }) => {
    await expect(page.getByText("72%")).toBeVisible();
    await expect(page.getByText("$12450.00")).toBeVisible();
  });

  test("switching branch updates dashboard metrics", async ({ page }) => {
    await page.getByTestId("tenant-branch-select").selectOption(FAKE_BRANCH_ID_2);
    await expect(page.getByText("45%")).toBeVisible();
    await expect(page.getByText("$3200.00")).toBeVisible();
  });

  test("switching organization resets branch list and metrics", async ({ page }) => {
    await page.getByTestId("tenant-org-select").selectOption(FAKE_ORG_ID_2);
    const branchSelect = page.getByTestId("tenant-branch-select");
    await expect(branchSelect.locator("option", { hasText: "Harbor Downtown" })).toBeVisible();
    await expect(branchSelect).toHaveValue(FAKE_BRANCH_ID_2B);
    await expect(page.getByText("88%")).toBeVisible();
    await expect(page.getByText("$28900.00")).toBeVisible();
  });

  test("persists tenant selection in localStorage", async ({ page }) => {
    await page.getByTestId("tenant-org-select").selectOption(FAKE_ORG_ID_2);
    await page.getByTestId("tenant-branch-select").selectOption(FAKE_BRANCH_ID_2B);

    const stored = await page.evaluate(() => localStorage.getItem("erp:tenant"));
    expect(stored).toContain(FAKE_ORG_ID_2);
    expect(stored).toContain(FAKE_BRANCH_ID_2B);

    await page.reload();
    await expect(page.getByTestId("tenant-org-select")).toHaveValue(FAKE_ORG_ID_2);
    await expect(page.getByTestId("tenant-branch-select")).toHaveValue(FAKE_BRANCH_ID_2B);
    await expect(page.getByText("88%")).toBeVisible();
  });

  test("sends tenant headers on API requests", async ({ page }) => {
    const dashboardRequests: { org?: string; branch?: string }[] = [];
    await page.route("**/localhost:3001/api/reporting/dashboard**", (route) => {
      dashboardRequests.push({
        org: route.request().headers()["x-organization-id"],
        branch: route.request().headers()["x-branch-id"],
      });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          occupancyPct: 50,
          activeReservations: 1,
          revenueToday: 100,
          lowStockAlerts: 0,
        }),
      });
    });

    await page.goto("/dashboard");
    await page.getByTestId("tenant-branch-select").selectOption(FAKE_BRANCH_ID_2);
    await page.waitForTimeout(500);

    expect(
      dashboardRequests.some(
        (r) => r.org === FAKE_ORG_ID && r.branch === FAKE_BRANCH_ID,
      ),
    ).toBe(true);
    expect(
      dashboardRequests.some(
        (r) => r.org === FAKE_ORG_ID && r.branch === FAKE_BRANCH_ID_2,
      ),
    ).toBe(true);
  });
});

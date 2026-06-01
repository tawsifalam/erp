import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";
import { pickTenantSelect } from "./helpers/tenant-select";
import { backendApiRoute, FAKE_BRANCH_ID_2, FAKE_ORG_ID_2, FAKE_BRANCH_ID_2B } from "./helpers/auth";

test.describe("Organization & branch selection", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
    await page.goto("/dashboard");
    await expect(page.getByTestId("tenant-selector")).toBeVisible();
  });

  test("shows organization and branch dropdowns with seed data", async ({ page }) => {
    const selector = page.getByTestId("tenant-selector");
    await expect(selector.getByRole("combobox").nth(0)).toContainText("Boulevard Café");
    await expect(selector.getByRole("combobox").nth(1)).toContainText("Main Branch");
  });

  test("defaults to first org and first branch metrics", async ({ page }) => {
    await expect(page.getByText("72%")).toBeVisible();
    await expect(page.getByText("$12450.00")).toBeVisible();
  });

  test("switching branch updates dashboard metrics", async ({ page }) => {
    await pickTenantSelect(page, "branch", "Annex Branch");
    await expect(page.getByText("45%")).toBeVisible();
    await expect(page.getByText("$3200.00")).toBeVisible();
  });

  test("switching organization resets branch list and metrics", async ({ page }) => {
    await pickTenantSelect(page, "organization", "Harbor Hotel Group");
    await expect(page.getByTestId("tenant-selector").getByRole("combobox").nth(1)).toContainText(
      "Harbor Downtown",
      { timeout: 10_000 },
    );
    await expect(page.getByText("88%")).toBeVisible();
    await expect(page.getByText("$28900.00")).toBeVisible();
  });

  test("persists tenant selection in localStorage", async ({ page }) => {
    await pickTenantSelect(page, "organization", "Harbor Hotel Group");
    await pickTenantSelect(page, "branch", "Harbor Downtown");

    const stored = await page.evaluate(() => localStorage.getItem("erp:tenant"));
    expect(stored).toContain(FAKE_ORG_ID_2);
    expect(stored).toContain(FAKE_BRANCH_ID_2B);

    await page.reload();
    await expect(page.getByTestId("tenant-selector").getByRole("combobox").nth(0)).toContainText(
      "Harbor Hotel Group",
    );
    await expect(page.getByTestId("tenant-selector").getByRole("combobox").nth(1)).toContainText(
      "Harbor Downtown",
    );
    await expect(page.getByText("88%")).toBeVisible();
  });

  test("sends tenant headers on API requests", async ({ page }) => {
    const dashboardRequests: { org?: string; branch?: string }[] = [];
    await page.route(backendApiRoute("reporting/dashboard"), (route) => {
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
          lowStockItems: [],
        }),
      });
    });

    await page.goto("/dashboard");
    await pickTenantSelect(page, "branch", "Annex Branch");
    await page.waitForTimeout(500);

    expect(
      dashboardRequests.some(
        (r) => r.org === "org-test-001" && r.branch === "branch-test-001",
      ),
    ).toBe(true);
    expect(
      dashboardRequests.some(
        (r) => r.org === "org-test-001" && r.branch === FAKE_BRANCH_ID_2,
      ),
    ).toBe(true);
  });
});

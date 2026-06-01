import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";

test.describe("Reports", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("loads report jobs table", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: /Reports/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: "branch_summary" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "COMPLETED" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
  });

  test("queues export and shows new job", async ({ page }) => {
    await page.goto("/reports");
    await page.getByRole("button", { name: "Export CSV" }).click();
    await expect(page.getByText(/Export queued/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("cell", { name: "branch_summary" }).first()).toBeVisible();
  });

  test("report type selector lists options", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.locator("select option", { hasText: "Branch summary" })).toHaveCount(1);
    await expect(page.locator("select option", { hasText: "Trial balance" })).toHaveCount(1);
    await expect(page.locator("select option", { hasText: "Profit & loss" })).toHaveCount(1);
    await expect(page.locator("select option", { hasText: "Balance sheet" })).toHaveCount(1);
  });

  test("queues profit and loss financial export", async ({ page }) => {
    await page.goto("/reports");
    const hidden = page.locator("select").filter({
      has: page.locator('option[value="profit_and_loss"]'),
    });
    await hidden.selectOption("profit_and_loss", { force: true });
    await expect(page.getByText("From")).toBeVisible();
    await page.getByRole("button", { name: "Export CSV" }).click();
    await expect(page.getByText(/Export queued/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("cell", { name: "profit_and_loss" }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

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
    await expect(page.getByRole("button", { name: "Download" })).toBeVisible();
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

  test("queues profit and loss financial export as PDF", async ({ page }) => {
    await page.goto("/reports");
    const hidden = page.locator("select").filter({
      has: page.locator('option[value="profit_and_loss"]'),
    });
    await hidden.selectOption("profit_and_loss", { force: true });
    await expect(page.getByText("From")).toBeVisible();
    await page.getByRole("button", { name: "Export PDF" }).click();
    await expect(page.getByText(/Export queued/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("cell", { name: "profit_and_loss" }).first()).toBeVisible({
      timeout: 10_000,
    });
    const row = page.getByRole("row").filter({ hasText: "profit_and_loss" }).first();
    const downloadResponse = page.waitForResponse(
      (r) => r.url().includes("/reporting/jobs/") && r.url().includes("/download") && r.ok(),
    );
    await row.getByRole("button", { name: "Download" }).click();
    const res = await downloadResponse;
    expect(res.headers()["content-type"]).toMatch(/application\/pdf/);
  });

  test("Export PDF hidden for branch-scoped reports", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("button", { name: "Export PDF" })).toHaveCount(0);
  });

  test("queues general ledger export with account code", async ({ page }) => {
    await page.goto("/reports");
    const typeSelect = page.locator("select").filter({
      has: page.locator('option[value="general_ledger"]'),
    });
    await typeSelect.selectOption("general_ledger", { force: true });
    await expect(page.getByText("Account code")).toBeVisible();
    await page.getByLabel("Account code").fill("1100");
    await page.getByRole("button", { name: "Export CSV" }).click();
    await expect(page.getByText(/Export queued/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("cell", { name: "general_ledger" }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

/**
 * Accounting + financial reports (runbook §7).
 */
import { test } from "@playwright/test";
import { pickAppSelectInDrawer } from "./helpers/app-select";
import { selectReportType, smokeSuffix, useSmokeHarness } from "./helpers/smoke-local.harness";

const { goto, expect } = useSmokeHarness();

test.describe("Smoke — Accounting", () => {
  test("Fiscal periods — seed open period visible", async ({ page }) => {
    await goto(page, "/accounting?tab=periods");
    await expect(page.getByRole("tab", { name: "Fiscal periods", selected: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "FY 2026" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("cell", { name: "OPEN" })).toBeVisible();
  });

  test("Chart of accounts — add account drawer", async ({ page }) => {
    await goto(page, "/accounting");
    await page.getByRole("tab", { name: /Chart of accounts/i }).click();
    await page.getByRole("button", { name: "+ Add account" }).click();
    await expect(page.getByRole("dialog", { name: "Add account" })).toBeVisible();
    await page.getByPlaceholder("Code").fill(`54${smokeSuffix().slice(-2)}`);
    await page.getByPlaceholder("Name").fill("Smoke Expense");
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Journal entries — post balanced journal", async ({ page }) => {
    await goto(page, "/accounting");
    await page.getByRole("button", { name: "+ Post journal" }).click();
    await expect(page.getByRole("dialog", { name: "Post journal entry" })).toBeVisible();
    const desc = `Smoke journal ${smokeSuffix()}`;
    await page.getByPlaceholder("Description").fill(desc);
    await page.getByRole("button", { name: "+ Line" }).click();
    await pickAppSelectInDrawer(page, "Post journal entry", 0, /5200 — Utilities Expense/);
    await pickAppSelectInDrawer(page, "Post journal entry", 1, /1100 — Bank Account/);
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("100");
    await numberInputs.nth(3).fill("100");
    await expect(page.getByText("Balanced ✓")).toBeVisible();
    await page.getByRole("button", { name: "Post journal", exact: true }).click();
    await expect(page.getByText(desc)).toBeVisible({ timeout: 15_000 });
  });

  test("Journal entries — reverse posted entry", async ({ page }) => {
    const desc = `Smoke reverse ${smokeSuffix()}`;
    await goto(page, "/accounting");
    await page.getByRole("button", { name: "+ Post journal" }).click();
    await page.getByPlaceholder("Description").fill(desc);
    await page.getByRole("button", { name: "+ Line" }).click();
    await pickAppSelectInDrawer(page, "Post journal entry", 0, /5200 — Utilities Expense/);
    await pickAppSelectInDrawer(page, "Post journal entry", 1, /1100 — Bank Account/);
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("50");
    await numberInputs.nth(3).fill("50");
    await page.getByRole("button", { name: "Post journal", exact: true }).click();
    await expect(page.getByText(desc)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Reverse" }).first().click();
    await page.getByTestId("confirm-dialog-confirm").click();
    await expect(page.getByText(/Journal entry reversed|reversed/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Reversal of: ${desc}`)).toBeVisible({ timeout: 15_000 });
  });

  test("Journal entries tab — list visible", async ({ page }) => {
    await goto(page, "/accounting");
    await expect(page.getByRole("tab", { name: "Journal entries" })).toBeVisible();
    await expect(page.getByRole("row").nth(1)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Smoke — Reports", () => {
  test("Profit & loss — queue export", async ({ page }) => {
    await goto(page, "/reports");
    await selectReportType(page, "profit_and_loss").selectOption("profit_and_loss", {
      force: true,
    });
    await expect(page.getByText("From")).toBeVisible();
    await page.getByRole("button", { name: "Export CSV" }).first().click();
    await expect(page.getByText(/Export queued/i)).toBeVisible({ timeout: 15_000 });
  });

  test("Trial balance — queue export", async ({ page }) => {
    await goto(page, "/reports");
    await selectReportType(page, "trial_balance").selectOption("trial_balance", { force: true });
    await page.getByRole("button", { name: "Export CSV" }).first().click();
    await expect(page.getByText(/Export queued/i)).toBeVisible({ timeout: 15_000 });
  });
});

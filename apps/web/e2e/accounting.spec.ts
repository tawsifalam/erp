import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";
import { pickAppSelectInDrawer } from "./helpers/app-select";

test.describe("Accounting", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("loads journal entries tab", async ({ page }) => {
    await page.goto("/accounting");
    await expect(page.getByRole("heading", { name: /Accounting/i })).toBeVisible();
    await expect(page.getByText("Room payment")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Journal entries" })).toBeVisible();
  });

  test("shows chart of accounts tab", async ({ page }) => {
    await page.goto("/accounting");
    await page.getByRole("tab", { name: /Chart of accounts/i }).click();
    await expect(page.getByRole("cell", { name: "1000" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Cash" })).toBeVisible();
  });

  test("add account appears in chart", async ({ page }) => {
    await page.goto("/accounting");
    await page.getByRole("tab", { name: /Chart of accounts/i }).click();
    await page.getByRole("button", { name: "+ Add account" }).click();
    await expect(page.getByRole("heading", { name: "Add account" })).toBeVisible();
    await page.getByPlaceholder("Code").fill("5400");
    await page.getByPlaceholder("Name").fill("Marketing Expense");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("cell", { name: "5400" })).toBeVisible({ timeout: 5000 });
  });

  test("post balanced journal entry", async ({ page }) => {
    await page.goto("/accounting");
    await page.getByRole("button", { name: "+ Post journal" }).click();
    await expect(page.getByRole("heading", { name: "Post journal entry" })).toBeVisible();
    await page.getByPlaceholder("Description").fill("Utility bill");
    await page.getByRole("button", { name: "+ Line" }).click();

    await pickAppSelectInDrawer(page, "Post journal entry", 0, /5200 — Utilities Expense/);
    await pickAppSelectInDrawer(page, "Post journal entry", 1, /1100 — Bank Account/);

    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("5000");
    await numberInputs.nth(3).fill("5000");

    await expect(page.getByText("Balanced ✓")).toBeVisible();
    await page.getByRole("button", { name: "Post journal", exact: true }).click();
    await expect(page.getByText("Utility bill")).toBeVisible({ timeout: 5000 });
  });

  test("fiscal periods tab lists seed period and closes", async ({ page }) => {
    await page.goto("/accounting");
    await page.getByRole("tab", { name: "Fiscal periods" }).click();
    await expect(page.getByRole("tab", { name: "Fiscal periods", selected: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "FY 2026" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("cell", { name: "OPEN" })).toBeVisible();

    await page.getByRole("button", { name: "Close" }).click();
    await page.getByTestId("confirm-dialog-confirm").click();
    await expect(page.getByRole("cell", { name: "CLOSED" })).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Reopen" }).click();
    await expect(page.getByRole("cell", { name: "OPEN" })).toBeVisible({ timeout: 5000 });
  });

  test("shows error for unbalanced journal before post", async ({ page }) => {
    await page.goto("/accounting");
    await page.getByRole("button", { name: "+ Post journal" }).click();

    await pickAppSelectInDrawer(page, "Post journal entry", 0, /1000 — Cash/);
    await page.getByRole("button", { name: "+ Line" }).click();
    await pickAppSelectInDrawer(page, "Post journal entry", 1, /4000 — Room Revenue/);

    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("100");
    await numberInputs.nth(3).fill("50");

    await expect(page.getByText("Not balanced")).toBeVisible();
    await expect(page.getByRole("button", { name: "Post journal", exact: true })).toBeDisabled();
  });
});

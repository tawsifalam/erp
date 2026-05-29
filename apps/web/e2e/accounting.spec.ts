import { test, expect } from "@playwright/test";
import { mockAuth, mockApiRoutes } from "./helpers/auth";

test.describe("Accounting", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
  });

  test("loads journal entries tab", async ({ page }) => {
    await page.goto("/accounting");
    await expect(page.getByRole("heading", { name: /Accounting/i })).toBeVisible();
    await expect(page.getByText("Room payment")).toBeVisible();
    await expect(page.getByText("Cash")).toBeVisible();
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
    await page.getByPlaceholder("Code").fill("5400");
    await page.getByPlaceholder("Name").fill("Marketing Expense");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("cell", { name: "5400" })).toBeVisible({ timeout: 5000 });
  });

  test("post balanced journal entry", async ({ page }) => {
    await page.goto("/accounting");
    await page.getByRole("tab", { name: /New journal/i }).click();
    await page.getByPlaceholder("Description").fill("Utility bill");
    await page.getByRole("button", { name: "+ Line" }).click();

    const accountSelects = page.locator('select:has(option:text("Account"))');
    await accountSelects.nth(0).selectOption({ label: /5200.*Utilities/ });
    await accountSelects.nth(1).selectOption({ label: /1100.*Bank/ });

    const debitInputs = page.getByPlaceholder("Debit");
    const creditInputs = page.getByPlaceholder("Credit");
    await debitInputs.nth(0).fill("5000");
    await creditInputs.nth(1).fill("5000");

    await expect(page.getByText("Balanced ✓")).toBeVisible();
    await page.getByRole("button", { name: "Post journal entry" }).click();
    await expect(page.getByText("Utility bill")).toBeVisible({ timeout: 5000 });
  });

  test("shows error for unbalanced journal before post", async ({ page }) => {
    await page.goto("/accounting");
    await page.getByRole("tab", { name: /New journal/i }).click();

    const accountSelects = page.locator('select:has(option:text("Account"))');
    await accountSelects.nth(0).selectOption({ label: /1000.*Cash/ });
    await page.getByRole("button", { name: "+ Line" }).click();
    await accountSelects.nth(1).selectOption({ label: /4000.*Room Revenue/ });

    await page.getByPlaceholder("Debit").first().fill("100");
    await page.getByPlaceholder("Credit").nth(1).fill("50");

    await expect(page.getByText("Not balanced")).toBeVisible();
    await page.getByRole("button", { name: "Post journal entry" }).click();
    await expect(page.getByText(/not balanced/i)).toBeVisible();
  });
});

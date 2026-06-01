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
    await page.getByRole("button", { name: "+ Add account" }).click();
    await expect(page.getByText("Add account")).toBeVisible();
    await page.getByPlaceholder("Code").fill("5400");
    await page.getByPlaceholder("Name").fill("Marketing Expense");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("cell", { name: "5400" })).toBeVisible({ timeout: 5000 });
  });

  test("post balanced journal entry", async ({ page }) => {
    await page.goto("/accounting");
    await page.getByRole("button", { name: "+ Post journal" }).click();
    await expect(page.getByText("Post journal entry")).toBeVisible();
    await page.getByPlaceholder("Description").fill("Utility bill");
    await page.getByRole("button", { name: "+ Line" }).click();

    const comboboxes = page.getByRole("combobox");
    await comboboxes.nth(0).click();
    await page.getByRole("option", { name: /5200.*Utilities/ }).click();
    await comboboxes.nth(1).click();
    await page.getByRole("option", { name: /1100.*Bank/ }).click();

    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("5000");
    await numberInputs.nth(3).fill("5000");

    await expect(page.getByText("Balanced ✓")).toBeVisible();
    await page.getByRole("button", { name: "Post journal", exact: true }).click();
    await expect(page.getByText("Utility bill")).toBeVisible({ timeout: 5000 });
  });

  test("shows error for unbalanced journal before post", async ({ page }) => {
    await page.goto("/accounting");
    await page.getByRole("button", { name: "+ Post journal" }).click();

    const comboboxes = page.getByRole("combobox");
    await comboboxes.nth(0).click();
    await page.getByRole("option", { name: /1000.*Cash/ }).click();
    await page.getByRole("button", { name: "+ Line" }).click();
    await comboboxes.nth(1).click();
    await page.getByRole("option", { name: /4000.*Room Revenue/ }).click();

    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("100");
    await numberInputs.nth(3).fill("50");

    await expect(page.getByText("Not balanced")).toBeVisible();
    await page.getByRole("button", { name: "Post journal", exact: true }).click();
    await expect(page.getByText(/not balanced/i)).toBeVisible();
  });
});

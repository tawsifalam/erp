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
});

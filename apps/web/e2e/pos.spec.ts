import { test, expect } from "@playwright/test";
import { mockAuth, mockApiRoutes } from "./helpers/auth";

test.describe("POS – Orders", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
  });

  test("loads and shows Orders heading", async ({ page }) => {
    await page.goto("/pos");
    await expect(page.getByRole("heading", { name: /Orders/i })).toBeVisible();
  });

  test("shows table with correct column headers", async ({ page }) => {
    await page.goto("/pos");

    const headers = page.locator("table thead th");
    await expect(headers.nth(0)).toHaveText("Table");
    await expect(headers.nth(1)).toHaveText("Total");
    await expect(headers.nth(2)).toHaveText("Status");
    await expect(headers.nth(3)).toHaveText("Payment");
  });

  test("displays order seed data", async ({ page }) => {
    await page.goto("/pos");

    await expect(page.getByRole("cell", { name: "T-3" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "T-7" })).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { mockAuth, mockApiRoutes } from "./helpers/auth";

test.describe("Inventory – Stock", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
  });

  test("loads and shows Stock heading", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: /Stock/i })).toBeVisible();
  });

  test("shows table with correct column headers", async ({ page }) => {
    await page.goto("/inventory");

    const headers = page.locator("table thead th");
    await expect(headers.nth(0)).toHaveText("SKU");
    await expect(headers.nth(1)).toHaveText("Name");
    await expect(headers.nth(2)).toHaveText("On hand");
    await expect(headers.nth(3)).toHaveText("Unit");
  });

  test("displays inventory seed data", async ({ page }) => {
    await page.goto("/inventory");

    await expect(page.getByRole("cell", { name: "RICE-BAS-25" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Basmati Rice" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "120" })).toBeVisible();

    await expect(page.getByRole("cell", { name: "OIL-OLV-5L" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Olive Oil" })).toBeVisible();

    await expect(page.getByRole("cell", { name: "MEAT-CHK-01" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Chicken Breast" })).toBeVisible();
  });
});

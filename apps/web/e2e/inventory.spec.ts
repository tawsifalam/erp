import { test, expect } from "@playwright/test";
import { mockAuth, mockApiRoutes } from "./helpers/auth";

test.describe("Inventory – Stock", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
  });

  test("loads and shows Stock heading", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: /Stock Management/i })).toBeVisible();
  });

  test("shows table with correct column headers", async ({ page }) => {
    await page.goto("/inventory");

    const headers = page.locator("table thead th");
    await expect(headers.nth(0)).toHaveText("SKU");
    await expect(headers.nth(1)).toHaveText("Name");
    await expect(headers.nth(2)).toHaveText("On Hand");
    await expect(headers.nth(3)).toHaveText("Unit");
  });

  test("displays inventory seed data", async ({ page }) => {
    await page.goto("/inventory");

    await expect(page.getByRole("cell", { name: "RICE-BAS-25" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Basmati Rice" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "120.00" })).toBeVisible();

    await expect(page.getByRole("cell", { name: "OIL-OLV-5L" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Olive Oil" })).toBeVisible();

    await expect(page.getByRole("cell", { name: "MEAT-CHK-01" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Chicken Breast" })).toBeVisible();
  });

  test("create item adds row to table", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: "+ New Item" }).click();
    await page.getByPlaceholder("Name").fill("Tomatoes");
    await page.getByPlaceholder("SKU").fill("VEG-TOM-01");
    await page.getByPlaceholder("Unit").fill("kg");
    await page.getByRole("button", { name: "Create Item" }).click();
    await expect(page.getByRole("cell", { name: "Tomatoes" })).toBeVisible({ timeout: 5000 });
  });

  test("record purchase movement updates on-hand stock", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: "+ Record Movement" }).click();
    await page
      .locator('select:has(option:text("Select Item"))')
      .selectOption({ label: /Basmati Rice/ });
    await page
      .locator('select:has(option:text("Purchase"))')
      .selectOption("PURCHASE");
    await page.getByPlaceholder("Qty").fill("10");
    await page.getByRole("button", { name: "Record Movement" }).click();
    await expect(page.getByRole("cell", { name: "130.00" })).toBeVisible({ timeout: 5000 });
  });

  test("edit item shows low stock when threshold raised", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("cell", { name: "Olive Oil" }).click();
    await page.getByPlaceholder("Low stock threshold").fill("100");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("LOW").first()).toBeVisible({ timeout: 5000 });
  });

  test("recipes tab loads menu item picker", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("tab", { name: /Recipes/i }).click();
    await expect(page.getByText(/Bill of materials/i)).toBeVisible();
    await expect(page.getByText("Select menu item")).toBeVisible();
  });

  test("recipes tab save recipe", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("tab", { name: /Recipes/i }).click();
    await page
      .locator('select:has(option:text("Select menu item"))')
      .selectOption({ index: 1 });
    await page
      .locator('select:has(option:text("Inventory item"))')
      .selectOption({ index: 1 });
    await page.getByPlaceholder("Qty").fill("0.5");
    await page.getByRole("button", { name: "Save recipe" }).click();
    await expect(page.getByText(/Recipe saved/i)).toBeVisible({ timeout: 5000 });
  });
});

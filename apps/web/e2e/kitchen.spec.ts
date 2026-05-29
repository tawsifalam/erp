import { test, expect } from "@playwright/test";
import { mockAuth, mockApiRoutes } from "./helpers/auth";

test.describe("Kitchen display", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
  });

  test("loads kitchen display with active orders", async ({ page }) => {
    await page.goto("/pos/kitchen");
    await expect(page.getByRole("heading", { name: /Kitchen Display/i })).toBeVisible();
    await expect(page.getByText(/Chicken Biryani/i)).toBeVisible();
  });

  test("has back link to POS", async ({ page }) => {
    await page.goto("/pos/kitchen");
    await expect(page.getByRole("link", { name: /Back to POS/i })).toBeVisible();
  });

  test("start prep → mark ready", async ({ page }) => {
    await page.goto("/pos/kitchen");
    const card = page.getByText("Chicken Biryani").locator("..").locator("..");
    await card.getByRole("button", { name: "Start prep" }).click();
    await expect(card.getByText("PREPARING")).toBeVisible({ timeout: 5000 });
    await card.getByRole("button", { name: "Mark ready" }).click();
    await expect(card.getByText("READY")).toBeVisible({ timeout: 5000 });
    await expect(card.getByText(/complete payment on POS/i)).toBeVisible();
  });
});

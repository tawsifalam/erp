import { test, expect } from "@playwright/test";
import { mockAuth, mockApiRoutes } from "./helpers/auth";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
  });

  test("loads and shows Overview heading", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Overview/i })).toBeVisible();
  });

  test("shows stat cards with data", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Occupancy")).toBeVisible();
    await expect(page.getByText("Active reservations")).toBeVisible();
    await expect(page.getByText("Revenue today (POS)")).toBeVisible();
    await expect(page.getByText("Low stock alerts")).toBeVisible();

    await expect(page.getByText("72%")).toBeVisible();
    await expect(page.getByText("5")).toBeVisible();
    await expect(page.getByText("$12450.00")).toBeVisible();
    await expect(page.getByText("3")).toBeVisible();
  });
});

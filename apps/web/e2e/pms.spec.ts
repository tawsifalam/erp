import { test, expect } from "@playwright/test";
import { mockAuth, mockApiRoutes } from "./helpers/auth";

test.describe("PMS – Reservations", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
  });

  test("loads and shows Reservations heading", async ({ page }) => {
    await page.goto("/pms");
    await expect(page.getByRole("heading", { name: /Reservations/i })).toBeVisible();
  });

  test("shows table with correct column headers", async ({ page }) => {
    await page.goto("/pms");

    const headers = page.locator("table thead th");
    await expect(headers.nth(0)).toHaveText("Guest");
    await expect(headers.nth(1)).toHaveText("Room");
    await expect(headers.nth(2)).toHaveText("Check-in");
    await expect(headers.nth(3)).toHaveText("Status");
  });

  test("displays reservation seed data", async ({ page }) => {
    await page.goto("/pms");

    await expect(page.getByRole("cell", { name: "Rahim Ahmed" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "101" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Fatima Khan" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "204" })).toBeVisible();
  });
});

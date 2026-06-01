import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";

test.describe("PMS – Reservations", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("loads PMS page", async ({ page }) => {
    await page.goto("/pms");
    await expect(page.getByRole("heading", { name: /Property management/i })).toBeVisible();
  });

  test("shows reservations tab with column headers", async ({ page }) => {
    await page.goto("/pms");

    await expect(page.getByRole("tab", { name: "Reservations" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Rooms" })).toBeVisible();
    const headers = page.locator("table thead th");
    await expect(headers.nth(0)).toHaveText("Guest");
    await expect(headers.nth(1)).toHaveText("Room");
    await expect(headers.nth(2)).toHaveText("Check-in");
  });

  test("displays reservation seed data", async ({ page }) => {
    await page.goto("/pms");

    await expect(page.getByRole("cell", { name: "Rahim Ahmed" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "101" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "Fatima Khan" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "204" }).first()).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";

async function expectStatCardValue(
  page: import("@playwright/test").Page,
  label: string,
  value: string,
) {
  const card = page.locator("div").filter({
    has: page.getByText(label, { exact: true }),
  });
  await expect(card.getByText(value, { exact: true })).toBeVisible();
}

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("loads and shows Overview heading", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Overview/i })).toBeVisible();
  });

  test("shows stat cards with data", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Occupancy", { exact: true })).toBeVisible();
    await expect(page.getByText("Active reservations", { exact: true })).toBeVisible();
    await expect(page.getByText("Revenue today", { exact: true })).toBeVisible();
    await expect(page.getByText("Low stock alerts", { exact: true })).toBeVisible();

    await expectStatCardValue(page, "Occupancy", "72%");
    await expectStatCardValue(page, "Active reservations", "5");
    await expectStatCardValue(page, "Revenue today", "$12450.00");
    await expectStatCardValue(page, "Low stock alerts", "3");
  });
});

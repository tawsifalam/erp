import { test, expect } from "@playwright/test";
import { mockAuth, mockApiRoutes } from "./helpers/auth";

test.describe("HR", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
  });

  test("loads employees list", async ({ page }) => {
    await page.goto("/hr");
    await expect(page.getByRole("heading", { name: /Human Resources/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Karim Hossain" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Head Chef" })).toBeVisible();
  });

  test("shows payroll runs tab", async ({ page }) => {
    await page.goto("/hr");
    await page.getByRole("tab", { name: /Payroll/i }).click();
    await expect(page.getByText("Karim Hossain")).toBeVisible();
  });
});

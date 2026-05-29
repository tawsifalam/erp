import { test, expect } from "@playwright/test";
import { mockAuth, mockApiRoutes } from "./helpers/auth";

test.describe("Reports", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
  });

  test("loads report jobs table", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: /Reports/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: "summary" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "COMPLETED" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
  });

  test("export button is visible", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("button", { name: /Export summary CSV/i })).toBeVisible();
  });
});

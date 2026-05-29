import { test, expect } from "@playwright/test";
import { mockAuth, mockApiRoutes } from "./helpers/auth";

test.describe("Settings – Organization & branch management", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
  });

  test("loads settings page with organization and branches", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("tab", { name: /Organization & branches/i })).toBeVisible();
    await expect(page.getByText("Current organization")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Main Branch" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Annex Branch" })).toBeVisible();
  });

  test("can add a new branch and see it in the table", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "+ Add branch" }).click();
    await page.getByPlaceholder("Branch name").fill("Rooftop Bar");
    await page.getByRole("button", { name: "Create branch" }).click();
    await expect(page.getByText(/Branch created/i)).toBeVisible();
    await expect(page.getByRole("cell", { name: "Rooftop Bar" })).toBeVisible();
  });

  test("can save organization name", async ({ page }) => {
    await page.goto("/settings");
    const nameInput = page.locator('input[value="Boulevard Café"]').first();
    await nameInput.fill("Boulevard Group");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText(/Organization updated/i)).toBeVisible();
    await expect(nameInput).toHaveValue("Boulevard Group");
  });

  test("inventory pools tab lists default pools", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: /Inventory pools/i }).click();
    await expect(page.getByText("Inventory pools")).toBeVisible();
    await expect(page.getByRole("cell", { name: "guest" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "staff" })).toBeVisible();
  });

  test("settings link appears in navigation", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  });
});

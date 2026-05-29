import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Hospitality ERP/i })).toBeVisible();
});

test("login page loads", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(page.getByRole("button", { name: /Sign in with PropelAuth/i })).toBeVisible();
});

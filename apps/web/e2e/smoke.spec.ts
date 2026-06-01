import { test, expect } from "@playwright/test";

test("home page redirects unauthenticated users to login", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth\/login/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Welcome/i })).toBeVisible();
});

test("login page loads", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(page.getByRole("button", { name: /^Sign in$/i })).toBeVisible();
});

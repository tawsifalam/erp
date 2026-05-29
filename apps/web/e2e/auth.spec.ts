import { test, expect } from "@playwright/test";

test.describe("Authentication flows", () => {
  test("visiting /dashboard without auth redirects to /auth/login", async ({ page }) => {
    const response = await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole("heading", { name: /Welcome/i })).toBeVisible();
  });

  test("login page shows sign-in and create-account buttons", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create account/i })).toBeVisible();
  });

  test("sign-in button navigates to /api/auth/login", async ({ page }) => {
    await page.goto("/auth/login");

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/auth/login")),
      page.getByRole("button", { name: /Sign in/i }).click(),
    ]);

    expect(request.url()).toContain("/api/auth/login");
  });
});

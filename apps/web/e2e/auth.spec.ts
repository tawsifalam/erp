import { test, expect } from "@playwright/test";

test.describe("Authentication flows", () => {
  test("visiting /dashboard without auth redirects to /auth/login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
  });

  test("login page shows email/password form and register link", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Create one/i })).toBeVisible();
  });

  test("sign-in submits credentials to API login", async ({ page }) => {
    await page.route(/\/api\/auth\/login$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "e2e-token",
          user: { id: "usr-e2e", email: "test@example.com", name: "Test" },
        }),
      }),
    );
    await page.route(/\/api\/auth\/refresh$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: null }),
      }),
    );

    await page.goto("/auth/login");
    await page.getByRole("textbox", { name: "Email" }).fill("test@example.com");
    await page.locator('input[type="password"]').fill("password123");

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/auth/login")),
      page.getByRole("button", { name: /Sign in/i }).click(),
    ]);

    expect(request.method()).toBe("POST");
    const body = request.postDataJSON() as { email: string; password: string };
    expect(body.email).toBe("test@example.com");
    expect(body.password).toBe("password123");
  });
});

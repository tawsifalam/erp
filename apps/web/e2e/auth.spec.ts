import { test, expect } from "@playwright/test";

const mockSession = {
  accessToken: "e2e-token",
  user: { id: "usr-e2e", email: "test@example.com", name: "Test User" },
};

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
        body: JSON.stringify(mockSession),
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

  test("register submits credentials to API register", async ({ page }) => {
    await page.route(/\/api\/auth\/register$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSession),
      }),
    );
    await page.route(/\/api\/auth\/refresh$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: null }),
      }),
    );

    await page.goto("/auth/register");
    await page.getByRole("textbox", { name: "Name" }).fill("Test User");
    await page.getByRole("textbox", { name: "Email" }).fill("new@example.com");
    await page.locator('input[type="password"]').first().fill("password123");
    await page.locator('input[type="password"]').nth(1).fill("password123");

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/auth/register")),
      page.getByRole("button", { name: /Create account/i }).click(),
    ]);

    expect(request.method()).toBe("POST");
    const body = request.postDataJSON() as { email: string; password: string; name: string };
    expect(body.email).toBe("new@example.com");
    expect(body.password).toBe("password123");
    expect(body.name).toBe("Test User");
  });

  test("forgot password submits email to API", async ({ page }) => {
    await page.route(/\/api\/auth\/forgot-password$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      }),
    );

    await page.goto("/auth/forgot-password");
    await page.getByRole("textbox", { name: "Email" }).fill("user@example.com");

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/auth/forgot-password")),
      page.getByRole("button", { name: /Send reset link/i }).click(),
    ]);

    expect(request.method()).toBe("POST");
    expect(request.postDataJSON()).toEqual({ email: "user@example.com" });
    await expect(page.getByText(/Check your email/i)).toBeVisible();
  });

  test("reset password submits token and new password", async ({ page }) => {
    await page.route(/\/api\/auth\/reset-password$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      }),
    );

    await page.goto("/auth/reset-password?token=reset-token-123");
    await page.locator('input[type="password"]').first().fill("newpassword1");
    await page.locator('input[type="password"]').nth(1).fill("newpassword1");

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/auth/reset-password")),
      page.getByRole("button", { name: /Update password/i }).click(),
    ]);

    expect(request.method()).toBe("POST");
    expect(request.postDataJSON()).toEqual({
      token: "reset-token-123",
      password: "newpassword1",
    });
  });

  test("accept invite loads preview and submits password", async ({ page }) => {
    await page.route(/\/api\/auth\/invite\//, (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          email: "invitee@example.com",
          organizationName: "Boulevard Cafe",
          organizationId: "org-1",
        }),
      });
    });
    await page.route(/\/api\/auth\/accept-invite$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSession),
      }),
    );
    await page.route(/\/api\/auth\/refresh$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: null }),
      }),
    );

    await page.goto("/auth/accept-invite?token=invite-token-123");
    await expect(page.getByRole("heading", { name: /Join Boulevard Cafe/i })).toBeVisible();
    await expect(page.getByText(/invitee@example.com/i)).toBeVisible();

    await page.getByRole("textbox", { name: "Your name" }).fill("Invitee");
    await page.locator('input[type="password"]').first().fill("password123");
    await page.locator('input[type="password"]').nth(1).fill("password123");

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/auth/accept-invite")),
      page.getByRole("button", { name: /Accept invite/i }).click(),
    ]);

    expect(request.method()).toBe("POST");
    expect(request.postDataJSON()).toEqual({
      token: "invite-token-123",
      password: "password123",
      name: "Invitee",
    });
  });

  test("onboarding redirects to login when unauthenticated", async ({ page }) => {
    await page.route(/\/api\/auth\/refresh$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: null }),
      }),
    );

    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page).toHaveURL(/return_to=.*onboarding/);
  });
});

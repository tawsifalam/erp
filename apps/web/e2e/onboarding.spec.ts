import { test, expect } from "@playwright/test";
import { backendApiListRoute, backendApiRoute, mockAuth, mockApiRoutes } from "./helpers/auth";

test.describe("Onboarding gate", () => {
  test("user without membership is redirected to onboarding", async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
    await page.unroute(backendApiRoute("tenants/onboarding/status"));

    await page.route(backendApiRoute("tenants/onboarding/status"), (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hasMembership: false,
          canAccessApp: false,
          pendingRequest: null,
        }),
      }),
    );

    await page.route(backendApiListRoute("tenants/organizations"), (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
      return route.fallback();
    });

    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  });
});

test.describe("Role-based navigation", () => {
  test("FRONT_DESK user sees PMS only in sidebar", async ({ page }) => {
    await mockAuth(page);

    await mockApiRoutes(page);

    await page.route(backendApiListRoute("tenants/organizations"), (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              organizationId: "org-test-001",
              role: "FRONT_DESK",
              organization: {
                id: "org-test-001",
                name: "Test Hotel",
                branches: [{ id: "branch-test-001", name: "Main" }],
              },
            },
          ]),
        });
      }
      return route.fallback();
    });

    await page.goto("/pms");
    await expect(page.getByRole("heading", { name: /PMS|Property/i }).first()).toBeVisible({
      timeout: 10000,
    });

    await expect(page.getByRole("link", { name: "PMS" })).toBeVisible();
    await expect(page.getByRole("link", { name: "HR" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  });

  test("FRONT_DESK user navigating to /dashboard is redirected to /pms", async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);

    await page.route(backendApiListRoute("tenants/organizations"), (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              organizationId: "org-test-001",
              role: "FRONT_DESK",
              organization: {
                id: "org-test-001",
                name: "Test Hotel",
                branches: [{ id: "branch-test-001", name: "Main" }],
              },
            },
          ]),
        });
      }
      return route.fallback();
    });

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/pms/, { timeout: 10000 });
  });

  test("FRONT_DESK user navigating to /hr is redirected to /pms", async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);

    await page.route(backendApiListRoute("tenants/organizations"), (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              organizationId: "org-test-001",
              role: "FRONT_DESK",
              organization: {
                id: "org-test-001",
                name: "Test Hotel",
                branches: [{ id: "branch-test-001", name: "Main" }],
              },
            },
          ]),
        });
      }
      return route.fallback();
    });

    await page.goto("/hr");
    await expect(page).toHaveURL(/\/pms/, { timeout: 10000 });
  });

  test("CASHIER user sees POS in sidebar and not dashboard link", async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);

    await page.route(backendApiListRoute("tenants/organizations"), (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              organizationId: "org-test-001",
              role: "CASHIER",
              organization: {
                id: "org-test-001",
                name: "Test Hotel",
                branches: [{ id: "branch-test-001", name: "Main" }],
              },
            },
          ]),
        });
      }
      return route.fallback();
    });

    await page.goto("/pos");
    await expect(page.getByRole("link", { name: "POS" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Accounting" })).toHaveCount(0);
  });

  test("CASHIER navigating to /dashboard is redirected to /pos", async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);

    await page.route(backendApiListRoute("tenants/organizations"), (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              organizationId: "org-test-001",
              role: "CASHIER",
              organization: {
                id: "org-test-001",
                name: "Test Hotel",
                branches: [{ id: "branch-test-001", name: "Main" }],
              },
            },
          ]),
        });
      }
      return route.fallback();
    });

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/pos/, { timeout: 10000 });
  });

  test("KITCHEN user navigating to /dashboard is redirected to kitchen display", async ({
    page,
  }) => {
    await mockAuth(page);
    await mockApiRoutes(page);

    await page.route(backendApiListRoute("tenants/organizations"), (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              organizationId: "org-test-001",
              role: "KITCHEN",
              organization: {
                id: "org-test-001",
                name: "Test Hotel",
                branches: [{ id: "branch-test-001", name: "Main" }],
              },
            },
          ]),
        });
      }
      return route.fallback();
    });

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/pos\/kitchen/, { timeout: 10000 });
  });
});

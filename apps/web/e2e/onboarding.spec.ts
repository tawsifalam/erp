import { test, expect } from "@playwright/test";
import { backendApiListRoute, backendApiRoute, mockAuth, mockApiRoutes } from "./helpers/auth";
import { mockApplicantApiRoutes, mockAuthApplicant } from "./helpers/applicant-auth";

test.describe("Onboarding create organization", () => {
  test("initial status check does not spam auth/sync or onboarding/status", async ({ page }) => {
    await mockAuthApplicant(page);
    await mockApplicantApiRoutes(page);

    const counts = { sync: 0, status: 0, organizations: 0 };

    await page.route("**/auth/sync", async (route) => {
      counts.sync += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ hasActiveMembership: false, pendingJoinRequest: null }),
      });
    });

    await page.unroute(backendApiRoute("tenants/onboarding/status"));
    await page.route(backendApiRoute("tenants/onboarding/status"), async (route) => {
      counts.status += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hasMembership: false,
          canAccessApp: false,
          pendingRequest: null,
        }),
      });
    });

    await page.route(backendApiListRoute("tenants/organizations"), async (route) => {
      if (route.request().method() === "GET") {
        counts.organizations += 1;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
      return route.fallback();
    });

    await page.goto("/onboarding", { waitUntil: "networkidle" });
    await expect(page.getByText("Welcome to One Venue")).toBeVisible();

    await page.waitForTimeout(1500);

    expect(counts.sync).toBeLessThanOrEqual(2);
    expect(counts.status).toBeLessThanOrEqual(2);
    expect(counts.organizations).toBe(0);
  });

  test("create organization posts once and navigates to dashboard", async ({ page }) => {
    await mockAuthApplicant(page);
    await mockApplicantApiRoutes(page);

    let createOrgCalls = 0;

    await page.unroute(backendApiListRoute("tenants/organizations"));
    await page.route(backendApiListRoute("tenants/organizations"), async (route) => {
      if (route.request().method() === "POST") {
        createOrgCalls += 1;
        const body = route.request().postDataJSON() as { name: string; timezone: string };
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            organization: {
              id: "org-created-001",
              name: body.name,
              branches: [{ id: "br-created-001", name: "Main Branch" }],
            },
          }),
        });
      }
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              organizationId: "org-created-001",
              role: "OWNER",
              organization: {
                id: "org-created-001",
                name: "Boulevard Test",
                branches: [{ id: "br-created-001", name: "Main Branch" }],
              },
            },
          ]),
        });
      }
      return route.fallback();
    });

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

    await page.goto("/onboarding");
    await page.getByPlaceholder("Boulevard Café").fill("Boulevard Test");
    await page.getByRole("button", { name: "Create organization" }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    expect(createOrgCalls).toBe(1);
  });
});

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

  test("ACCOUNTANT user navigating to /settings is redirected to /accounting", async ({
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
              role: "ACCOUNTANT",
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

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/accounting/, { timeout: 10000 });
  });

  test("HR user sees HR link and not settings or PMS in sidebar", async ({ page }) => {
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
              role: "HR",
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
    await expect(page.getByRole("link", { name: "HR" })).toBeVisible();
    await expect(page.getByRole("link", { name: "PMS" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  });
});

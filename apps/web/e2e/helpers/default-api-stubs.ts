import type { Page } from "@playwright/test";

/**
 * Baseline API stubs for mocked E2E (browser calls localhost:3000/api via Next).
 * Prevents Next dev proxy errors when Nest is not running on :3001.
 * Register test-specific routes after this — Playwright uses the last matching route.
 */
export async function installDefaultApiStubs(page: Page) {
  await page.route("**/api/auth/refresh", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accessToken: null }),
    });
  });

  await page.route("**/api/tenants/organizations", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const pathname = new URL(route.request().url()).pathname;
    if (pathname !== "/api/tenants/organizations") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}

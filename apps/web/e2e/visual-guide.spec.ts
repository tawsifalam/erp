/**
 * Generates UI screenshots for docs/visual-guide.md.
 * Uses the same API mocks as other E2E tests (UI-only walkthrough).
 *
 * Regenerate: pnpm --filter @erp/web test:visual-guide
 */
import { test } from "@playwright/test";
import { captureModuleScreenshot } from "./helpers/visual-guide";
import { gotoApp, setupE2ePage } from "./helpers/setup";

test.describe.configure({ mode: "serial" });

test.describe("Visual guide — module screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("capture all module screens", async ({ page }) => {
    await gotoApp(page, "/dashboard");
    await captureModuleScreenshot(page, "01-dashboard");

    await gotoApp(page, "/pms");
    await captureModuleScreenshot(page, "02-pms-reservations");

    await page.getByRole("tab", { name: "Rooms" }).click();
    await captureModuleScreenshot(page, "03-pms-rooms");

    await page.getByRole("tab", { name: "Rates" }).click();
    await captureModuleScreenshot(page, "04-pms-rates");

    await gotoApp(page, "/pos");
    await captureModuleScreenshot(page, "05-pos");

    await gotoApp(page, "/pos/kitchen");
    await captureModuleScreenshot(page, "06-kitchen");

    await gotoApp(page, "/inventory");
    await captureModuleScreenshot(page, "07-inventory");

    await gotoApp(page, "/procurement");
    await captureModuleScreenshot(page, "08-procurement-vendors");

    await page.getByRole("tab", { name: "Purchase orders" }).click();
    await captureModuleScreenshot(page, "09-procurement-orders");

    await gotoApp(page, "/accounting");
    await captureModuleScreenshot(page, "10-accounting");

    await gotoApp(page, "/hr");
    await captureModuleScreenshot(page, "11-hr");

    await gotoApp(page, "/reports");
    await captureModuleScreenshot(page, "12-reports");

    await gotoApp(page, "/settings");
    await captureModuleScreenshot(page, "13-settings-organization");

    await gotoApp(page, "/settings?tab=team");
    await captureModuleScreenshot(page, "14-settings-team");

    await gotoApp(page, "/settings?tab=audit");
    await captureModuleScreenshot(page, "15-settings-audit");
  });
});

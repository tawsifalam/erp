import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";

test.describe("Notification preferences", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("settings notifications tab lists event types", async ({ page }) => {
    await page.goto("/settings?tab=notifications");
    await expect(page.getByRole("tab", { name: "Notifications", selected: true })).toBeVisible();
    await expect(page.getByText("Low stock alerts")).toBeVisible();
    await expect(page.getByText("Report ready")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Report ready in-app" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Report ready email" })).not.toBeChecked();
  });

  test("disabling in-app blocks report ready bell notification", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("notification-bell").click();
    const list = page.getByTestId("notification-list");
    const countBefore = await list.locator('[data-testid^="notification-item-"]').count();

    await page.goto("/settings?tab=notifications");
    await page.getByRole("checkbox", { name: "Report ready in-app" }).uncheck();
    await expect(page.getByText(/preference saved/i)).toBeVisible({ timeout: 5000 });

    await page.goto("/reports");
    await page.getByRole("button", { name: "Export CSV" }).first().click();
    await expect(page.getByText(/Export queued/i)).toBeVisible({ timeout: 5000 });

    await page.goto("/dashboard");
    await page.getByTestId("notification-bell").click();
    await expect(list.locator('[data-testid^="notification-item-"]')).toHaveCount(countBefore);
  });

  test("can mute an event type by disabling both channels", async ({ page }) => {
    await page.goto("/settings?tab=notifications");
    await page.getByRole("checkbox", { name: "Payroll completed email" }).uncheck();
    await expect(page.getByText(/preference saved/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("checkbox", { name: "Payroll completed in-app" }).uncheck();
    await expect(page.getByText(/preference saved/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("checkbox", { name: "Payroll completed in-app" })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Payroll completed email" })).not.toBeChecked();
  });
});

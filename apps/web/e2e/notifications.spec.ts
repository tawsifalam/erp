import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";
import { acceptConfirmDialog } from "./helpers/confirm-dialog";

test.describe("Notifications", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("bell shows unread count from seed data", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForResponse(
      (r) => r.url().includes("/notifications/unread-count") && r.ok(),
    );
    const badge = page.getByTestId("notification-unread-badge");
    await expect(badge).toBeVisible({ timeout: 10_000 });
    await expect(badge).toHaveText("2");
  });

  test("dropdown lists unread and read notifications", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("notification-bell").click();
    const list = page.getByTestId("notification-list");
    await expect(list.getByText("Report ready")).toBeVisible();
    await expect(list.getByText("Low stock alert")).toBeVisible();
    await expect(list.getByText("Payroll completed")).toBeVisible();
  });

  test("clicking a notification marks it read and lowers badge count", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("notification-bell").click();
    await page.getByTestId("notification-item-ntf_seed_1").click();
    await expect(page).toHaveURL(/\/reports/);
    await page.goto("/dashboard");
    await expect(page.getByTestId("notification-unread-badge")).toHaveText("1");
  });

  test("mark all read clears the badge", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("notification-bell").click();
    await page.getByRole("button", { name: "Mark all read" }).click();
    await page.goto("/dashboard");
    await expect(page.getByTestId("notification-unread-badge")).toHaveCount(0);
  });

  test("raising stock threshold triggers low stock notification", async ({ page }) => {
    await page.goto("/inventory");
    const row = page.getByRole("row").filter({ hasText: "Olive Oil" });
    await row.getByRole("button", { name: "View" }).click();
    await page.getByRole("button", { name: "Save changes" }).waitFor({ state: "visible" });
    await page.locator('input[type="number"]').fill("100");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("LOW").first()).toBeVisible({ timeout: 10_000 });

    await page.goto("/dashboard");
    await page.getByTestId("notification-bell").click();
    await expect(
      page.getByTestId("notification-list").getByText(/threshold 100/),
    ).toBeVisible();
  });

  test("report export adds report ready notification", async ({ page }) => {
    await page.goto("/reports");
    await page.getByRole("button", { name: "Export CSV" }).first().click();
    await expect(page.getByText(/Export queued/i)).toBeVisible({ timeout: 10_000 });

    await page.goto("/dashboard");
    await page.getByTestId("notification-bell").click();
    await expect(
      page.getByTestId("notification-list").getByText(/export is ready/i).first(),
    ).toBeVisible();
  });

  test("payroll run adds payroll notification", async ({ page }) => {
    await page.goto("/hr");
    await page.getByRole("tab", { name: /Payroll/i }).click();
    await page.getByRole("button", { name: /Run payroll for current month/i }).click();
    await acceptConfirmDialog(page);
    await expect(page.getByText(/Payroll run queued/i)).toBeVisible({ timeout: 10_000 });

    await page.goto("/dashboard");
    await page.getByTestId("notification-bell").click();
    await expect(
      page.getByTestId("notification-list").getByText(/Payroll run has been queued/i),
    ).toBeVisible();
  });
});

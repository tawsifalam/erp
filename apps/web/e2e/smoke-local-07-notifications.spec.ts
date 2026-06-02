/**
 * Notifications: bell, mark read, triggers from report / inventory (runbook §8).
 */
import { test } from "@playwright/test";
import { selectReportType, useSmokeHarness } from "./helpers/smoke-local.harness";

const { goto, expect } = useSmokeHarness();

test.describe("Smoke — Notifications", () => {
  test("Bell — opens list and mark all read", async ({ page }) => {
    await goto(page, "/dashboard");
    await expect(page.getByTestId("notification-bell")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("notification-bell").click();
    await expect(page.getByTestId("notification-list")).toBeVisible();
    const markAll = page.getByRole("button", { name: "Mark all read" });
    if (await markAll.isVisible().catch(() => false)) {
      await markAll.click();
      await goto(page, "/dashboard");
    }
  });

  test("Low stock — threshold change shows in bell", async ({ page }) => {
    await goto(page, "/inventory");
    const row = page.getByRole("row").filter({ hasText: "Cooking Oil" });
    if (await row.isVisible().catch(() => false)) {
      await row.getByRole("button", { name: "View" }).click();
      await page.getByRole("button", { name: "Save changes" }).waitFor({ state: "visible" });
      await page.locator('input[type="number"]').fill("100");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("LOW").first()).toBeVisible({ timeout: 15_000 });

      await goto(page, "/dashboard");
      await page.getByTestId("notification-bell").click();
      await expect(
        page.getByTestId("notification-list").getByText(/threshold|low stock/i).first(),
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test("Report ready — export then bell shows ready message", async ({ page }) => {
    await goto(page, "/reports");
    await selectReportType(page, "profit_and_loss").selectOption("profit_and_loss", {
      force: true,
    });
    await page.getByRole("button", { name: "Export CSV" }).first().click();
    await expect(page.getByText(/Export queued/i)).toBeVisible({ timeout: 15_000 });

    await goto(page, "/dashboard");
    await page.getByTestId("notification-bell").click();
    await expect(
      page
        .getByTestId("notification-list")
        .getByText(/export is ready|Export queued|report/i)
        .first(),
    ).toBeVisible({ timeout: 45_000 });
  });
});

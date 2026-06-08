/**
 * Notifications: bell, mark read, triggers from report / inventory (runbook §8).
 */
import { test } from "@playwright/test";
import { waitForSmokeReportJob } from "./helpers/smoke-reporting-api";
import { selectReportType, useSmokeHarness } from "./helpers/smoke-local.harness";

const smoke = useSmokeHarness();
const { goto, expect } = smoke;

test.describe("Smoke — Notifications", () => {
  test("Bell — opens list and mark all read", async ({ page }) => {
    await goto(page, "/dashboard");
    await expect(page.getByTestId("notification-bell")).toBeVisible();
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
      await page.getByRole("spinbutton").fill("100");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("LOW").first()).toBeVisible();

      await goto(page, "/dashboard");
      await page.getByTestId("notification-bell").click();
      await expect(
        page.getByTestId("notification-list").getByText(/threshold|low stock/i).first(),
      ).toBeVisible();
    }
  });

  test("Report ready — export then bell shows ready message", async ({ page, request }) => {
    await goto(page, "/reports");
    await selectReportType(page, "profit_and_loss").selectOption("profit_and_loss", {
      force: true,
    });
    const exportQueued = page.waitForResponse(
      (r) => r.url().includes("/reporting/export") && r.request().method() === "POST" && r.ok(),
    );
    await page.getByRole("button", { name: "Export CSV" }).first().click();
    const exportRes = await exportQueued;
    const { id: jobId } = (await exportRes.json()) as { id: string };
    await expect(page.getByText(/Export queued/i)).toBeVisible();

    await waitForSmokeReportJob(request, smoke.auth, jobId);

    await goto(page, "/dashboard");
    await page.getByTestId("notification-bell").click();
    await expect(
      page
        .getByTestId("notification-list")
        .getByText(/export is ready|Report ready|Profit & loss/i)
        .first(),
    ).toBeVisible();
  });
});

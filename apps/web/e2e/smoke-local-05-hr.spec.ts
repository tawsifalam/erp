/**
 * HR: employees, attendance, staff meals, payroll (runbook §5 UI).
 */
import { test } from "@playwright/test";
import { pickAppSelectInDrawer } from "./helpers/app-select";
import { acceptConfirmDialog } from "./helpers/confirm-dialog";
import { smokeSuffix, useSmokeHarness } from "./helpers/smoke-local.harness";

const { goto, expect } = useSmokeHarness();

test.describe("Smoke — HR", () => {
  test("Employees — add employee drawer", async ({ page }) => {
    await goto(page, "/hr");
    await page.getByRole("button", { name: "+ Add employee" }).click();
    await expect(page.getByRole("dialog", { name: "Add employee" })).toBeVisible();
    await page.getByPlaceholder("Name").fill(`Smoke Staff ${smokeSuffix()}`);
    await page.getByPlaceholder("Designation").fill("Trainee");
    await page.getByPlaceholder("Salary").fill("15000");
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Attendance — record attendance drawer", async ({ page }) => {
    await goto(page, "/hr");
    await page.getByRole("tab", { name: /Attendance/i }).click();
    await page.getByRole("button", { name: "+ Record attendance" }).click();
    await pickAppSelectInDrawer(page, "Record attendance", 0, "Karim Hossain");
    await expect(page.getByRole("dialog", { name: "Record attendance" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Staff meals — record meal drawer", async ({ page }) => {
    await goto(page, "/hr");
    await page.getByRole("tab", { name: /Staff meals/i }).click();
    await page.getByRole("button", { name: "+ Record meal" }).click();
    await pickAppSelectInDrawer(page, "Record staff meal", 0, "Karim Hossain");
    await pickAppSelectInDrawer(page, "Record staff meal", 1, "Staff Lunch");
    await page.getByPlaceholder("Meals consumed").fill("1");
    await expect(page.getByRole("dialog", { name: "Record staff meal" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Payroll — run payroll for current month (queued)", async ({ page }) => {
    await goto(page, "/hr");
    await page.getByRole("tab", { name: /Payroll/i }).click();
    await expect(page.getByRole("button", { name: /Run payroll for current month/i })).toBeVisible();
    const payrollRun = page.waitForResponse(
      (r) => r.url().includes("/payroll/runs") && r.request().method() === "POST" && r.ok(),
    );
    await page.getByRole("button", { name: /Run payroll for current month/i }).click();
    await acceptConfirmDialog(page);
    await payrollRun;
    await expect(page.getByText(/Payroll run queued|Payroll run completed/i)).toBeVisible();
  });
});

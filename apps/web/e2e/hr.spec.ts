import { test, expect } from "@playwright/test";
import { mockAuth, mockApiRoutes } from "./helpers/auth";

test.describe("HR", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
  });

  test("loads employees list", async ({ page }) => {
    await page.goto("/hr");
    await expect(page.getByRole("heading", { name: /Human Resources/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Karim Hossain" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Head Chef" })).toBeVisible();
  });

  test("add employee", async ({ page }) => {
    await page.goto("/hr");
    await page.getByPlaceholder("Name").fill("New Hire");
    await page.getByPlaceholder("Designation").fill("Trainee");
    await page.getByPlaceholder("Salary").fill("12000");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("cell", { name: "New Hire" })).toBeVisible({ timeout: 5000 });
  });

  test("can edit employee and save", async ({ page }) => {
    await page.goto("/hr");
    const row = page.getByRole("row").filter({ hasText: "Karim Hossain" });
    await row.getByRole("textbox").first().fill("Karim H. Updated");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/Employee updated/i)).toBeVisible();
    await expect(page.getByRole("cell", { name: "Karim H. Updated" })).toBeVisible();
  });

  test("can terminate employee and hide from attendance dropdown", async ({ page }) => {
    await page.goto("/hr");
    const row = page.getByRole("row").filter({ hasText: "Nasreen Begum" });
    await row.getByRole("button", { name: "Terminate" }).click();
    await page.getByTestId("confirm-dialog-confirm").click();
    await expect(page.getByText(/Employee terminated/i)).toBeVisible();
    await expect(page.getByText("TERMINATED")).toBeVisible();
    await page.getByRole("tab", { name: /Attendance/i }).click();
    const employeeSelect = page.locator('select:has(option:text("Select employee"))');
    await expect(employeeSelect.locator("option", { hasText: "Nasreen Begum" })).toHaveCount(0);
    await expect(employeeSelect.locator("option", { hasText: "Karim Hossain" })).toBeVisible();
  });

  test("clock attendance shows in recent list", async ({ page }) => {
    await page.goto("/hr");
    await page.getByRole("tab", { name: /Attendance/i }).click();
    await page.locator('select:has(option:text("Select employee"))').selectOption({ label: "Karim Hossain" });
    await page.getByRole("button", { name: "Record attendance" }).click();
    await expect(page.getByText(/Karim Hossain — CLOCK IN/i)).toBeVisible({ timeout: 5000 });
  });

  test("record staff meal consumption", async ({ page }) => {
    await page.goto("/hr");
    await page.getByRole("tab", { name: /Staff meals/i }).click();
    await expect(page.getByText("Staff Lunch")).toBeVisible();
    await page.locator('select:has(option:text("Employee"))').selectOption({ label: "Karim Hossain" });
    await page.locator('select:has(option:text("Meal recipe"))').selectOption({ label: "Staff Lunch" });
    await page.getByPlaceholder("Meals consumed").fill("1");
    await page.getByRole("button", { name: "Record meal" }).click();
    await expect(page.getByText(/recipe ingredients deducted/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/1× Staff Lunch/i)).toBeVisible();
  });

  test("shows payroll runs tab", async ({ page }) => {
    await page.goto("/hr");
    await page.getByRole("tab", { name: /Payroll/i }).click();
    await expect(page.getByText("Karim Hossain")).toBeVisible();
    await page.getByRole("button", { name: /Run payroll for current month/i }).click();
    await expect(page.getByText(/Payroll run queued/i)).toBeVisible({ timeout: 5000 });
  });
});

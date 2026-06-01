/**
 * Step-by-step form / drawer screenshots (non-PMS modules).
 * PMS setup and operations: visual-guide-flows-pms.spec.ts
 */
import { test, expect } from "@playwright/test";
import { pickAppSelectInDrawer } from "./helpers/app-select";
import {
  captureDrawerStep,
  captureFlowStep,
  resetFlowSteps,
} from "./helpers/visual-guide";
import { gotoApp, setupE2ePage } from "./helpers/setup";

test.describe.configure({ mode: "serial" });

test.describe("Visual guide — step-by-step flows", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("Procurement — add vendor", async ({ page }) => {
    const flow = "procurement-add-vendor";
    resetFlowSteps(flow);

    await gotoApp(page, "/procurement");
    await captureFlowStep(page, flow, "01-vendors-list", { fullPage: true });

    await page.getByRole("button", { name: "+ Add vendor" }).click();
    await captureDrawerStep(page, flow, "02-add-vendor-drawer", "Add vendor");

    await page.getByLabel("Name").fill("Guide Supplies Co");
    await page.getByLabel("Contact").fill("Sam");
    await captureDrawerStep(page, flow, "03-fields-filled", "Add vendor");
  });

  test("Procurement — purchase order and receive", async ({ page }) => {
    const flow = "procurement-po-receive";
    resetFlowSteps(flow);

    await gotoApp(page, "/procurement");
    await page.getByRole("tab", { name: "Purchase orders" }).click();
    await captureFlowStep(page, flow, "01-po-list", { fullPage: true });

    await page.getByRole("button", { name: "+ New PO" }).click();
    await captureDrawerStep(page, flow, "02-new-po-drawer", "New purchase order");

    await pickAppSelectInDrawer(page, "New purchase order", 0, "Fresh Foods Ltd");
    await captureDrawerStep(page, flow, "03-vendor-selected", "New purchase order");

    await pickAppSelectInDrawer(page, "New purchase order", 1, /Basmati Rice/);
    await page.getByLabel("Quantity").fill("10");
    await page.getByLabel("Unit price").fill("120");
    await captureDrawerStep(page, flow, "04-line-filled", "New purchase order");

    await page.getByRole("button", { name: "Create & submit" }).click();
    await page.getByText(/Purchase order created/i).waitFor({ timeout: 10_000 });
    await captureFlowStep(page, flow, "05-po-submitted", { fullPage: true });

    await page.getByRole("button", { name: "Receive" }).first().click();
    await captureDrawerStep(page, flow, "06-receive-drawer", "Receive goods");

    const receiveDrawer = page.getByRole("dialog", { name: "Receive goods" });
    await pickAppSelectInDrawer(page, "Receive goods", 0, /Basmati Rice/);
    await receiveDrawer.locator('input[type="number"]').fill("10");
    await captureDrawerStep(page, flow, "07-receive-qty-filled", "Receive goods");
  });

  test("Inventory — new item and movement", async ({ page }) => {
    const flow = "inventory-stock";
    resetFlowSteps(flow);

    await gotoApp(page, "/inventory");
    await captureFlowStep(page, flow, "01-stock-list", { fullPage: true });

    await page.getByRole("button", { name: "+ New item" }).click();
    await captureDrawerStep(page, flow, "02-new-item-drawer", "New inventory item");
    await page.getByPlaceholder("Name").fill("Demo Tomatoes");
    await page.getByPlaceholder("SKU").fill("VEG-DEMO-01");
    await captureDrawerStep(page, flow, "03-item-fields-filled", "New inventory item");

    await page.getByRole("button", { name: "Cancel" }).first().click();

    await page.getByRole("button", { name: "+ Record movement" }).click();
    await captureDrawerStep(page, flow, "04-movement-drawer", "Record movement");
    await pickAppSelectInDrawer(page, "Record movement", 0, /Basmati Rice/);
    await page.locator('input[type="number"]').first().fill("5");
    await captureDrawerStep(page, flow, "05-movement-filled", "Record movement");
  });

  test("POS — order to kitchen and pay", async ({ page }) => {
    const flow = "pos-order-lifecycle";
    resetFlowSteps(flow);

    await gotoApp(page, "/pos");
    const draftRow = page.getByRole("row").filter({ hasText: "T-1" });
    await captureFlowStep(page, flow, "01-orders-draft", { fullPage: true });

    await draftRow.getByRole("button", { name: "Send to kitchen" }).click();
    await expect(draftRow.getByText("SUBMITTED", { exact: true })).toBeVisible({ timeout: 10_000 });
    await captureFlowStep(page, flow, "02-after-send-kitchen", { fullPage: true });

    await draftRow.getByRole("button", { name: "Complete & Pay" }).click();
    await captureDrawerStep(page, flow, "03-complete-pay-drawer", "Complete & pay");
  });

  test("HR — add employee", async ({ page }) => {
    const flow = "hr-add-employee";
    resetFlowSteps(flow);

    await gotoApp(page, "/hr");
    await captureFlowStep(page, flow, "01-employees-list", { fullPage: true });

    await page.getByRole("button", { name: "+ Add employee" }).click();
    await captureDrawerStep(page, flow, "02-add-employee-drawer", "Add employee");

    await page.getByPlaceholder("Name").fill("Visual Guide Staff");
    await page.getByPlaceholder("Designation").fill("Trainee");
    await page.getByPlaceholder("Salary").fill("15000");
    await captureDrawerStep(page, flow, "03-fields-filled", "Add employee");
  });

  test("HR — attendance", async ({ page }) => {
    const flow = "hr-attendance";
    resetFlowSteps(flow);

    await gotoApp(page, "/hr");
    await page.getByRole("tab", { name: /Attendance/i }).click();
    await captureFlowStep(page, flow, "01-attendance-tab", { fullPage: true });

    await page.getByRole("button", { name: "+ Record attendance" }).click();
    await pickAppSelectInDrawer(page, "Record attendance", 0, "Karim Hossain");
    await captureDrawerStep(page, flow, "02-attendance-drawer", "Record attendance");
  });

  test("HR — staff meal", async ({ page }) => {
    const flow = "hr-staff-meal";
    resetFlowSteps(flow);

    await gotoApp(page, "/hr");
    await page.getByRole("tab", { name: /Staff meals/i }).click();
    await captureFlowStep(page, flow, "01-staff-meals-tab", { fullPage: true });

    await page.getByRole("button", { name: "+ Record meal" }).click();
    await pickAppSelectInDrawer(page, "Record staff meal", 0, "Karim Hossain");
    await pickAppSelectInDrawer(page, "Record staff meal", 1, "Staff Lunch");
    await page.getByPlaceholder("Meals consumed").fill("1");
    await captureDrawerStep(page, flow, "02-meal-drawer-filled", "Record staff meal");
  });

  test("HR — payroll", async ({ page }) => {
    const flow = "hr-payroll";
    resetFlowSteps(flow);

    await gotoApp(page, "/hr");
    await page.getByRole("tab", { name: /Payroll/i }).click();
    await captureFlowStep(page, flow, "01-payroll-tab", { fullPage: true });
    await page.getByRole("button", { name: /Run payroll for current month/i }).click();
    await captureFlowStep(page, flow, "02-payroll-confirm-dialog", { fullPage: true });
  });

  test("POS — menu category", async ({ page }) => {
    const flow = "pos-menu-category";
    resetFlowSteps(flow);

    await gotoApp(page, "/pos");
    await page.getByRole("tab", { name: "Menu" }).click();
    await captureFlowStep(page, flow, "01-menu-tab", { fullPage: true });

    await page.getByRole("button", { name: "+ Add category" }).click();
    await page.getByPlaceholder("Category name").fill("Desserts");
    await captureFlowStep(page, flow, "02-new-category-filled", { fullPage: true });
  });

  test("Inventory — recipe (BOM)", async ({ page }) => {
    const flow = "inventory-recipe";
    resetFlowSteps(flow);

    await gotoApp(page, "/inventory");
    await page.getByRole("tab", { name: "Recipes (BOM)" }).click();
    await captureFlowStep(page, flow, "01-recipes-list", { fullPage: true });

    await page.getByRole("button", { name: "Edit recipe" }).first().click();
    await captureDrawerStep(page, flow, "02-bom-drawer", "Bill of materials");
  });

  test("Accounting — add account", async ({ page }) => {
    const flow = "accounting-add-account";
    resetFlowSteps(flow);

    await gotoApp(page, "/accounting");
    await page.getByRole("tab", { name: /Chart of accounts/i }).click();
    await captureFlowStep(page, flow, "01-chart-of-accounts", { fullPage: true });

    await page.getByRole("button", { name: "+ Add account" }).click();
    await captureDrawerStep(page, flow, "02-add-account-drawer", "Add account");
    await page.getByPlaceholder("Code").fill("5400");
    await page.getByPlaceholder("Name").fill("Marketing Expense");
    await captureDrawerStep(page, flow, "03-account-fields-filled", "Add account");
  });

  test("Accounting — post journal", async ({ page }) => {
    const flow = "accounting-post-journal";
    resetFlowSteps(flow);

    await gotoApp(page, "/accounting");
    await captureFlowStep(page, flow, "01-journals-list", { fullPage: true });

    await page.getByRole("button", { name: "+ Post journal" }).click();
    await captureDrawerStep(page, flow, "02-journal-drawer-empty", "Post journal entry");

    await page.getByPlaceholder("Description").fill("Utility bill");
    await page.getByRole("button", { name: "+ Line" }).click();
    await pickAppSelectInDrawer(page, "Post journal entry", 0, /5200 — Utilities Expense/);
    await pickAppSelectInDrawer(page, "Post journal entry", 1, /1100 — Bank Account/);
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("5000");
    await numberInputs.nth(3).fill("5000");
    await expect(page.getByText("Balanced ✓")).toBeVisible();
    await captureDrawerStep(page, flow, "03-journal-balanced", "Post journal entry");
  });

  test("Settings — branch and team invite", async ({ page }) => {
    const flow = "settings-admin";
    resetFlowSteps(flow);

    await gotoApp(page, "/settings");
    await captureFlowStep(page, flow, "01-organization-tab", { fullPage: true });

    await page.getByRole("button", { name: "+ Add branch" }).click();
    await captureDrawerStep(page, flow, "02-add-branch-drawer", "Add branch");
    await page.getByPlaceholder("Branch name").fill("Guide Branch");
    await captureDrawerStep(page, flow, "03-branch-name-filled", "Add branch");
    await page.getByRole("button", { name: "Cancel" }).first().click();

    await gotoApp(page, "/settings?tab=team");
    await captureFlowStep(page, flow, "04-team-tab", { fullPage: true });

    await page.getByPlaceholder("colleague@example.com").fill("guide.user@example.com");
    await captureFlowStep(page, flow, "05-invite-email-filled", { fullPage: true });
  });

  test("Settings — inventory pool", async ({ page }) => {
    const flow = "settings-inventory-pool";
    resetFlowSteps(flow);

    await gotoApp(page, "/settings?tab=pools");
    await captureFlowStep(page, flow, "01-pools-list", { fullPage: true });

    await page.getByRole("button", { name: "+ Add pool" }).click();
    await captureDrawerStep(page, flow, "02-add-pool-drawer", "Add inventory pool");
    await page.getByPlaceholder("Code (e.g. minibar)").fill("minibar");
    await page.getByPlaceholder("Display name").fill("In-room minibar");
    await captureDrawerStep(page, flow, "03-pool-fields-filled", "Add inventory pool");
  });

  test("Reports — financial export", async ({ page }) => {
    const flow = "reports-export";
    resetFlowSteps(flow);

    await gotoApp(page, "/reports");
    await captureFlowStep(page, flow, "01-reports-default", { fullPage: true });

    const hidden = page.locator("select").filter({
      has: page.locator('option[value="profit_and_loss"]'),
    });
    await hidden.selectOption("profit_and_loss", { force: true });
    await captureFlowStep(page, flow, "02-pl-selected", { fullPage: true });
  });
});

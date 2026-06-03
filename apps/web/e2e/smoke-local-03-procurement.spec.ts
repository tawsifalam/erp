/**
 * Procurement: vendor, PO submit, receive, accounting journal check.
 */
import { test } from "@playwright/test";
import { pickAppSelectInDrawer } from "./helpers/app-select";
import { ensureProcurementVendor, useSmokeHarness } from "./helpers/smoke-local.harness";

const { goto, expect } = useSmokeHarness();

test.describe("Smoke — Procurement", () => {
  test("Vendors — list and add vendor drawer", async ({ page }) => {
    await ensureProcurementVendor(page);
    const vendorsPanel = page.getByRole("tabpanel", { name: "Vendors" });
    await vendorsPanel.getByRole("button", { name: "+ Add vendor" }).click();
    await expect(page.getByRole("dialog", { name: "Add vendor" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("PO — create, submit, receive", async ({ page }) => {
    await ensureProcurementVendor(page);
    await page.getByRole("tab", { name: "Purchase orders" }).click();
    await page.getByRole("button", { name: "+ New PO" }).click();
    await pickAppSelectInDrawer(page, "New purchase order", 0, "Fresh Foods Ltd");
    await pickAppSelectInDrawer(page, "New purchase order", 1, /Rice \(INV-001\)/);
    await page.getByLabel("Quantity").fill("5");
    await page.getByLabel("Unit price").fill("99");
    await page.getByRole("button", { name: "Create & submit" }).click();
    await expect(page.getByText(/Purchase order created/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("cell", { name: "SUBMITTED" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Receive" }).first().click();
    const receiveDrawer = page.getByRole("dialog", { name: "Receive goods" });
    await pickAppSelectInDrawer(page, "Receive goods", 0, /Rice \(remaining/);
    await receiveDrawer.getByRole("spinbutton").fill("5");
    await receiveDrawer.getByRole("button", { name: "Receive" }).click();
    await expect(page.getByText(/Goods received/i)).toBeVisible({ timeout: 15_000 });
  });

  test("Vendor payment — record after PO receive", async ({ page }) => {
    await goto(page, "/procurement");
    await page.getByRole("tab", { name: "Vendor payments" }).click();
    await page.getByRole("button", { name: "+ Record payment" }).click();
    await pickAppSelectInDrawer(page, "Record vendor payment", 0, "Fresh Foods Ltd");
    await page.getByLabel("Amount").fill("495");
    await page.getByRole("button", { name: "Record payment", exact: true }).click();
    await expect(page.getByText(/Vendor payment recorded/i)).toBeVisible({ timeout: 15_000 });
  });

  test("Inventory — stock visible after receive", async ({ page }) => {
    await goto(page, "/inventory");
    await expect(page.getByRole("cell", { name: "Rice" }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Accounting — procurement journal entries", async ({ page }) => {
    await goto(page, "/accounting");
    await expect(page.getByRole("tab", { name: "Journal entries" })).toBeVisible();
    await expect(page.getByRole("row").nth(1)).toBeVisible({ timeout: 15_000 });
  });
});

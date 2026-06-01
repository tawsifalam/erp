import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";
import { pickAppSelectInDrawer } from "./helpers/app-select";

test.describe("Procurement", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("vendors tab lists seed vendor", async ({ page }) => {
    await page.goto("/procurement");
    await expect(page.getByRole("cell", { name: "Fresh Foods Ltd" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Rashid" })).toBeVisible();
  });

  test("can add a vendor", async ({ page }) => {
    await page.goto("/procurement");
    await page.getByRole("button", { name: "+ Add vendor" }).click();
    await page.getByLabel("Name").fill("Metro Supplies");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/Vendor created/i)).toBeVisible();
    await expect(page.getByRole("cell", { name: "Metro Supplies" })).toBeVisible();
  });

  test("create PO, submit, and receive updates status", async ({ page }) => {
    await page.goto("/procurement");
    await page.getByRole("tab", { name: "Purchase orders" }).click();
    await page.getByRole("button", { name: "+ New PO" }).click();
    await pickAppSelectInDrawer(page, "New purchase order", 0, "Fresh Foods Ltd");
    await pickAppSelectInDrawer(page, "New purchase order", 1, /Basmati Rice/);
    await page.getByLabel("Quantity").fill("10");
    await page.getByLabel("Unit price").fill("120");
    await page.getByRole("button", { name: "Create & submit" }).click();
    await expect(page.getByText(/Purchase order created/i)).toBeVisible();
    await expect(page.getByRole("cell", { name: "SUBMITTED" })).toBeVisible();

    await page.getByRole("button", { name: "Receive" }).click();
    const receiveDrawer = page.getByRole("dialog", { name: "Receive goods" });
    await pickAppSelectInDrawer(page, "Receive goods", 0, /Basmati Rice/);
    await receiveDrawer.locator('input[type="number"]').fill("10");
    await receiveDrawer.getByRole("button", { name: "Receive" }).click();
    await expect(page.getByText(/Goods received/i)).toBeVisible();
    await expect(page.getByRole("cell", { name: "RECEIVED" })).toBeVisible();
  });
});

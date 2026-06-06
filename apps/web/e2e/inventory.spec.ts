import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";
import { pickAppSelectInDrawer } from "./helpers/app-select";
import { acceptConfirmDialog } from "./helpers/confirm-dialog";

test.describe("Inventory – Stock", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("loads and shows Stock heading", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: /Stock Management/i })).toBeVisible();
  });

  test("shows table with correct column headers", async ({ page }) => {
    await page.goto("/inventory");

    await expect(page.getByRole("columnheader", { name: "SKU" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "On hand" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Unit" })).toBeVisible();
  });

  test("displays inventory seed data", async ({ page }) => {
    await page.goto("/inventory");

    await expect(page.getByRole("cell", { name: "RICE-BAS-25" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Basmati Rice" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "120.00" })).toBeVisible();

    await expect(page.getByRole("cell", { name: "OIL-OLV-5L" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Olive Oil" })).toBeVisible();

    await expect(page.getByRole("cell", { name: "MEAT-CHK-01" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Chicken Breast" })).toBeVisible();
  });

  test("create item adds row to table", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: "+ New item" }).click();
    await expect(page.getByRole("heading", { name: "New inventory item" })).toBeVisible();
    await page.getByPlaceholder("Name").fill("Tomatoes");
    await page.getByPlaceholder("SKU").fill("VEG-TOM-01");
    await page.getByPlaceholder("Unit").fill("kg");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("cell", { name: "Tomatoes" })).toBeVisible({ timeout: 5000 });
  });

  test("record purchase movement updates on-hand stock", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: "+ Record movement" }).click();
    await expect(page.getByRole("heading", { name: "Record movement" })).toBeVisible();
    await pickAppSelectInDrawer(page, "Record movement", 0, /Basmati Rice/);
    await page.getByRole("spinbutton").first().fill("10");
    await page.getByRole("button", { name: "Record", exact: true }).click();
    await expect(page.getByRole("cell", { name: "130.00" })).toBeVisible({ timeout: 5000 });
  });

  test("can change pool when editing an item", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: "+ New item" }).click();
    await page.getByPlaceholder("Name").fill("Cucumbers");
    await page.getByPlaceholder("SKU").fill("VEG-CUC-01");
    await page.getByPlaceholder("Unit").fill("kg");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("cell", { name: "Cucumbers" })).toBeVisible({ timeout: 5000 });

    const row = page.getByRole("row").filter({ hasText: "Cucumbers" });
    await row.getByRole("button", { name: "View" }).click();
    await pickAppSelectInDrawer(page, /Cucumbers/, 0, /Staff pantry/);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(row.getByRole("cell", { name: "Staff pantry" })).toBeVisible({ timeout: 5000 });
  });

  test("can delete a zero-stock item", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: "+ New item" }).click();
    await page.getByPlaceholder("Name").fill("Disposable Cups");
    await page.getByPlaceholder("SKU").fill("SUP-CUP-01");
    await page.getByPlaceholder("Unit").fill("pcs");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("cell", { name: "Disposable Cups" })).toBeVisible({
      timeout: 5000,
    });

    const row = page.getByRole("row").filter({ hasText: "Disposable Cups" });
    await row.getByRole("button", { name: "View" }).click();
    await page.getByRole("button", { name: "Delete item" }).click();
    await acceptConfirmDialog(page);
    await expect(page.getByRole("cell", { name: "Disposable Cups" })).toHaveCount(0);
  });

  test("edit item shows low stock when threshold raised", async ({ page }) => {
    await page.goto("/inventory");
    const row = page.getByRole("row").filter({ hasText: "Olive Oil" });
    await row.getByRole("button", { name: "View" }).click();
    await page.getByRole("button", { name: "Save changes" }).waitFor({ state: "visible" });
    await page.getByRole("spinbutton").fill("100");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("LOW").first()).toBeVisible({ timeout: 5000 });
  });

  test("recipes tab lists menu items", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("tab", { name: /Recipes/i }).click();
    await expect(page.getByText(/Link menu items to inventory/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit recipe" }).first()).toBeVisible();
  });

  test("recipes tab save recipe via drawer", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("tab", { name: /Recipes/i }).click();
    await page.getByRole("button", { name: "Edit recipe" }).first().click();
    await expect(page.getByRole("heading", { name: "Bill of materials" })).toBeVisible();
    await page.getByPlaceholder("Qty").fill("0.5");
    await page.getByRole("button", { name: "Save recipe" }).click();
    await expect(page.getByText(/Recipe saved/i)).toBeVisible({ timeout: 5000 });
  });
});

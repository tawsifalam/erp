import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";
import { acceptConfirmDialog } from "./helpers/confirm-dialog";
import { clickRowAction } from "./helpers/row-actions";
import { showAllPosOrders } from "./helpers/pos";

test.describe("POS – Orders", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("loads POS page with tabs", async ({ page }) => {
    await page.goto("/pos");
    await expect(page.getByRole("heading", { name: /Point of Sale/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Orders" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Menu" })).toBeVisible();
  });

  test("shows order table with correct column headers", async ({ page }) => {
    await page.goto("/pos");

    const headers = page.locator("table thead th");
    await expect(headers.nth(0)).toHaveText("Table");
    await expect(headers.nth(1)).toHaveText("Items");
    await expect(headers.nth(2)).toHaveText("Total");
    await expect(headers.nth(3)).toHaveText("Status");
    await expect(headers.nth(4)).toHaveText("Payment");
  });

  test("displays order seed data", async ({ page }) => {
    await page.goto("/pos");
    await showAllPosOrders(page);

    await expect(page.getByRole("cell", { name: "T-3" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "T-7" })).toBeVisible();
  });
});

test.describe("POS – lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("submit draft → complete with payment", async ({ page }) => {
    await page.goto("/pos");
    const draftRow = page.getByRole("row").filter({ hasText: "T-1" });
    await expect(draftRow.getByText("DRAFT")).toBeVisible();

    await draftRow.getByRole("button", { name: "Send to kitchen" }).click();
    await expect(draftRow.getByText("SUBMITTED")).toBeVisible({ timeout: 5000 });

    await draftRow.getByRole("button", { name: "Complete & Pay" }).click();
    await expect(page.getByRole("heading", { name: "Complete & pay" })).toBeVisible();
    await page.getByRole("button", { name: "Complete" }).click();
    await showAllPosOrders(page);
    await expect(draftRow.getByText("COMPLETED", { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test("cancel submitted order", async ({ page }) => {
    await page.goto("/pos");
    const row = page.getByRole("row").filter({ hasText: "T-3" });
    await clickRowAction(row, "Cancel");
    await acceptConfirmDialog(page);
    await showAllPosOrders(page);
    await expect(row.getByText("CANCELLED", { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test("partial payment on submitted order", async ({ page }) => {
    await page.goto("/pos");
    const row = page.getByRole("row").filter({ hasText: "T-3" });
    await row.getByRole("button", { name: "Complete & Pay" }).click();
    const input = page.getByRole("spinbutton").last();
    await input.fill("300");
    await page.getByRole("button", { name: "Complete" }).click();
    await showAllPosOrders(page);
    await expect(row.getByText("PARTIAL", { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test("menu tab add category", async ({ page }) => {
    await page.goto("/pos");
    await page.getByRole("tab", { name: "Menu" }).click();
    await page.getByRole("button", { name: "+ Add category" }).click();
    await expect(page.getByText("New category")).toBeVisible();
    await page.getByPlaceholder("Category name").fill("Desserts");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Desserts")).toBeVisible({ timeout: 5000 });
  });

  test("delete cancelled order removes row", async ({ page }) => {
    await page.goto("/pos");
    const ordersPanel = page.getByRole("tabpanel", { name: "Orders" });
    await ordersPanel.getByRole("combobox").click();
    await page.getByRole("option", { name: "Cancelled" }).click();
    const row = page.getByRole("row").filter({ hasText: "T-9" });
    await expect(row).toBeVisible();
    await clickRowAction(row, "Delete");
    await acceptConfirmDialog(page);
    await expect(page.getByRole("row").filter({ hasText: "T-9" })).toHaveCount(0);
  });
});

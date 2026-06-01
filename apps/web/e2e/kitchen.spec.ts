import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";
import { acceptConfirmDialog } from "./helpers/confirm-dialog";
import { clickRowAction } from "./helpers/row-actions";
import { showAllPosOrders } from "./helpers/pos";

test.describe("Kitchen display", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("loads kitchen display with active orders", async ({ page }) => {
    await page.goto("/pos/kitchen");
    await expect(page.getByRole("heading", { name: /Kitchen Display/i })).toBeVisible();
    await expect(page.getByText(/Chicken Biryani/i)).toBeVisible();
  });

  test("has back link to POS", async ({ page }) => {
    await page.goto("/pos/kitchen");
    await expect(page.getByRole("link", { name: /Back to POS/i })).toBeVisible();
  });

  test("start prep → mark ready", async ({ page }) => {
    await page.goto("/pos/kitchen");
    const card = page.getByText("Chicken Biryani").locator("..").locator("..");
    await card.getByRole("button", { name: "Start prep" }).click();
    await expect(card.getByText("PREPARING")).toBeVisible({ timeout: 5000 });
    await card.getByRole("button", { name: "Mark ready" }).click();
    await expect(card.getByText("READY")).toBeVisible({ timeout: 5000 });
    await expect(card.getByText(/complete payment on POS/i)).toBeVisible();
  });

  test("cancelled order disappears from kitchen queue", async ({ page }) => {
    await page.goto("/pos/kitchen");
    await expect(page.getByText(/Chicken Biryani/i)).toBeVisible();

    await page.goto("/pos");
    const row = page.getByRole("row").filter({ hasText: "T-3" });
    await clickRowAction(row, "Cancel");
    await acceptConfirmDialog(page);
    await showAllPosOrders(page);
    await expect(row.getByText("CANCELLED", { exact: true })).toBeVisible({ timeout: 5000 });

    await page.goto("/pos/kitchen");
    await expect(page.getByText(/Chicken Biryani/i)).not.toBeVisible();
    await expect(page.getByText(/No active tickets/i)).toBeVisible();
  });
});

import type { Page } from "@playwright/test";

/** POS orders tab defaults to hiding completed/cancelled orders. */
export async function showAllPosOrders(page: Page) {
  const ordersPanel = page.getByRole("tabpanel", { name: "Orders" });
  await ordersPanel.getByRole("combobox").click();
  await page.getByRole("option", { name: "All orders" }).click();
}

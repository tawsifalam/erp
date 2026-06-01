import type { Locator, Page } from "@playwright/test";

/** Open the ⋯ row actions menu on a table row and click an item by label. */
export async function clickRowAction(row: Locator, label: string) {
  await row.getByRole("button", { name: "Actions" }).click();
  await row.page().getByRole("menuitem", { name: label }).click();
}

/** Same as clickRowAction but row is resolved from page + filter text. */
export async function clickRowActionOnPage(page: Page, rowFilter: string, label: string) {
  const row = page.getByRole("row").filter({ hasText: rowFilter });
  await clickRowAction(row, label);
}

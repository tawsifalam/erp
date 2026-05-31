import type { Page } from "@playwright/test";

/** Click through the Chakra confirm dialog after triggering a destructive action. */
export async function acceptConfirmDialog(page: Page) {
  await page.getByTestId("confirm-dialog-confirm").click();
}

import type { Page } from "@playwright/test";

export function auditPanel(page: Page) {
  return page.getByRole("tabpanel", { name: "Audit log" });
}

export function auditTable(page: Page) {
  return auditPanel(page).getByRole("table");
}

/** Set entity filter via hidden select (AppSelect). */
export async function filterAuditByEntity(page: Page, label: string) {
  const hidden = auditPanel(page).locator('select[aria-label="Entity type filter"]');
  await hidden.selectOption({ label }, { force: true });
  await auditPanel(page).getByRole("button", { name: "Apply" }).click();
}

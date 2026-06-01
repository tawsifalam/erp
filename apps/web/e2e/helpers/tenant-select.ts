import type { Page } from "@playwright/test";

/** Pick organization or branch in the header tenant selector. */
export async function pickTenantSelect(
  page: Page,
  which: "organization" | "branch",
  optionLabel: string,
) {
  const index = which === "organization" ? 0 : 1;
  const hidden = page.locator(
    `select[aria-label="${which === "organization" ? "Organization" : "Branch"}"]`,
  );
  try {
    await hidden.selectOption({ label: optionLabel }, { force: true });
    await hidden.dispatchEvent("change");
    return;
  } catch {
    // Fall through.
  }
  await page.getByTestId("tenant-selector").getByRole("combobox").nth(index).click();
  await page.getByRole("option", { name: optionLabel }).click({ timeout: 10_000 });
}

import type { Page } from "@playwright/test";
import { SMOKE_TIMEOUT } from "./smoke-constants";

/** Pick organization or branch in the header tenant selector. */
export async function pickTenantSelect(
  page: Page,
  which: "organization" | "branch",
  optionLabel: string,
) {
  const index = which === "organization" ? 0 : 1;
  const ariaLabel = which === "organization" ? "Organization" : "Branch";
  const hidden = page.locator(`select[aria-label="${ariaLabel}"]`);
  try {
    await hidden.selectOption({ label: optionLabel }, { force: true, timeout: SMOKE_TIMEOUT });
    await hidden.dispatchEvent("change");
    return;
  } catch {
    // Fall through to visible combobox.
  }
  await page.getByTestId("tenant-selector").getByRole("combobox").nth(index).click({
    timeout: SMOKE_TIMEOUT,
  });
  await page.getByRole("option", { name: optionLabel }).click({ timeout: SMOKE_TIMEOUT });
}

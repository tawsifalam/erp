import type { Page } from "@playwright/test";
import { SMOKE_TIMEOUT } from "./smoke-constants";

async function selectHiddenOption(
  hidden: ReturnType<Page["locator"]>,
  optionLabel: string | RegExp,
) {
  if (typeof optionLabel === "string") {
    await hidden.selectOption({ label: optionLabel }, { force: true, timeout: SMOKE_TIMEOUT });
    return;
  }
  const labels = await hidden.locator("option").allTextContents();
  const index = labels.findIndex((text) => optionLabel.test(text));
  if (index < 0) {
    throw new Error(`No option matching ${optionLabel}`);
  }
  await hidden.selectOption({ index }, { force: true, timeout: SMOKE_TIMEOUT });
}

async function pickVisibleOption(
  scope: ReturnType<Page["locator"]>,
  page: Page,
  comboboxIndex: number,
  optionLabel: string | RegExp,
) {
  await scope.getByRole("combobox").nth(comboboxIndex).click({ timeout: SMOKE_TIMEOUT });
  const optionInScope = scope.getByRole("option", { name: optionLabel });
  if (await optionInScope.count()) {
    await optionInScope.click({ timeout: SMOKE_TIMEOUT });
    return;
  }
  await page.getByRole("option", { name: optionLabel }).click({ timeout: SMOKE_TIMEOUT });
}

/** Open an AppSelect inside a drawer/dialog and choose an option. */
export async function pickAppSelectInDrawer(
  page: Page,
  drawerTitle: string | RegExp,
  comboboxIndex: number,
  optionLabel: string | RegExp,
) {
  const drawer = page.getByRole("dialog", { name: drawerTitle });
  const hidden = drawer.locator("select").nth(comboboxIndex);
  if ((await hidden.count()) > 0) {
    try {
      await selectHiddenOption(hidden, optionLabel);
      return;
    } catch {
      // Hidden select labels may differ from visible list — use combobox.
    }
  }
  await pickVisibleOption(drawer, page, comboboxIndex, optionLabel);
}

/** Open an AppSelect by index among page comboboxes (prefer drawer helpers when header selects exist). */
export async function pickAppSelect(
  page: Page,
  comboboxIndex: number,
  optionLabel: string | RegExp,
) {
  const combobox = page.getByRole("combobox").nth(comboboxIndex);
  const root = combobox.locator("xpath=ancestor::*[@data-scope='select'][1]");
  const hidden = root.locator("select");
  if ((await hidden.count()) > 0) {
    try {
      await selectHiddenOption(hidden, optionLabel);
      return;
    } catch {
      // Fall through to visible list interaction.
    }
  }
  await combobox.click({ timeout: SMOKE_TIMEOUT });
  await page.getByRole("option", { name: optionLabel }).click({ timeout: SMOKE_TIMEOUT });
}

/** Tenant/org AppSelects use aria-label on the hidden select. */
export async function pickAppSelectByAriaLabel(
  page: Page,
  ariaLabel: string,
  optionLabel: string | RegExp,
) {
  const hidden = page.locator(`select[aria-label="${ariaLabel}"]`);
  if ((await hidden.count()) > 0) {
    try {
      await selectHiddenOption(hidden, optionLabel);
      return;
    } catch {
      // Fall through to visible list interaction.
    }
  }
  const trigger = page
    .getByTestId("tenant-selector")
    .getByRole("combobox")
    .filter({ has: page.locator(`select[aria-label="${ariaLabel}"]`) });
  const combobox =
    (await trigger.count()) > 0
      ? trigger.first()
      : page.getByRole("combobox", { name: ariaLabel });
  await combobox.click({ timeout: SMOKE_TIMEOUT });
  await page.getByRole("option", { name: optionLabel }).click({ timeout: SMOKE_TIMEOUT });
}

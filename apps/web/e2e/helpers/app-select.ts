import type { Page } from "@playwright/test";

async function selectHiddenOption(
  hidden: ReturnType<Page["locator"]>,
  optionLabel: string | RegExp,
) {
  if (typeof optionLabel === "string") {
    await hidden.selectOption({ label: optionLabel }, { force: true });
    return;
  }
  const labels = await hidden.locator("option").allTextContents();
  const index = labels.findIndex((text) => optionLabel.test(text));
  if (index < 0) {
    throw new Error(`No option matching ${optionLabel}`);
  }
  await hidden.selectOption({ index }, { force: true });
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
    await selectHiddenOption(hidden, optionLabel);
    return;
  }
  await drawer.getByRole("combobox").nth(comboboxIndex).click();
  await page.getByRole("option", { name: optionLabel }).click({ timeout: 10_000 });
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
    await selectHiddenOption(hidden, optionLabel);
    return;
  }
  await combobox.click();
  await page.getByRole("option", { name: optionLabel }).click({ timeout: 10_000 });
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
  await combobox.click();
  await page.getByRole("option", { name: optionLabel }).click({ timeout: 10_000 });
}

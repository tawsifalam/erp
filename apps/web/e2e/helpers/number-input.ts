import type { Locator, Page } from "@playwright/test";

/** Chakra NumberInput exposes a spinbutton; use instead of input[type="number"]. */
export function numberInputs(scope: Page | Locator): Locator {
  return scope.getByRole("spinbutton");
}

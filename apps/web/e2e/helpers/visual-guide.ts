import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";

/** Screenshots for docs/visual-guide.md (repo root: docs/visual/screenshots). */
export const VISUAL_SCREENSHOT_DIR = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "docs",
  "visual",
  "screenshots",
);

const flowStepCounters = new Map<string, number>();

export function resetFlowSteps(flowKey: string) {
  flowStepCounters.set(flowKey, 0);
}

/** Full-page module overview (top-level PNG in screenshots/). */
export async function captureModuleScreenshot(page: Page, filename: string) {
  await mkdir(VISUAL_SCREENSHOT_DIR, { recursive: true });
  const filePath = path.join(
    VISUAL_SCREENSHOT_DIR,
    filename.endsWith(".png") ? filename : `${filename}.png`,
  );
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

type CaptureOptions = {
  /** Capture a drawer/dialog only (recommended for forms). */
  locator?: Locator;
  /** Default false for flow steps (viewport); true for full-page steps. */
  fullPage?: boolean;
};

/**
 * Step screenshot under screenshots/flows/{flowKey}/01-slug.png
 * Call resetFlowSteps(flowKey) at the start of each flow.
 */
export async function captureFlowStep(
  page: Page,
  flowKey: string,
  slug: string,
  options?: CaptureOptions,
) {
  const prev = flowStepCounters.get(flowKey) ?? 0;
  const step = prev + 1;
  flowStepCounters.set(flowKey, step);

  const dir = path.join(VISUAL_SCREENSHOT_DIR, "flows", flowKey);
  await mkdir(dir, { recursive: true });
  // Slugs in specs often include a step prefix (e.g. "01-list"); avoid "01-01-list.png".
  const baseSlug = slug.replace(/^\d{2}-/, "");
  const filename = `${String(step).padStart(2, "0")}-${baseSlug}.png`;
  const filePath = path.join(dir, filename);

  if (options?.locator) {
    await options.locator.screenshot({ path: filePath });
  } else {
    await page.screenshot({
      path: filePath,
      fullPage: options?.fullPage ?? false,
    });
  }

  return { step, slug, filename, filePath, flowKey };
}

/** Shorthand: screenshot an open dialog by title. */
export async function captureDrawerStep(
  page: Page,
  flowKey: string,
  slug: string,
  dialogTitle: string | RegExp,
) {
  const drawer = page.getByRole("dialog", { name: dialogTitle });
  await drawer.waitFor({ state: "visible", timeout: 10_000 });
  return captureFlowStep(page, flowKey, slug, { locator: drawer });
}

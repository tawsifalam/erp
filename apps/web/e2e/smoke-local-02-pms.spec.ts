/**
 * PMS: setup order (room type → room → guest → packages → rates) + operations.
 */
import { test } from "@playwright/test";
import { pickAppSelectInDrawer } from "./helpers/app-select";
import { clickRowActionOnPage } from "./helpers/row-actions";
import { openPmsTab, smokeSuffix, useSmokeHarness } from "./helpers/smoke-local.harness";

const { goto, expect } = useSmokeHarness();

test.describe("Smoke — PMS setup", () => {
  test("Room types — add drawer", async ({ page }) => {
    await openPmsTab(page, "Room types");
    await page.getByRole("button", { name: "+ Add room type" }).click();
    await expect(page.getByRole("dialog", { name: "New room type" })).toBeVisible();
    await page.getByPlaceholder("Name").fill(`Smoke Type ${smokeSuffix()}`);
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Rooms — add drawer with room type", async ({ page }) => {
    await openPmsTab(page, "Rooms");
    await page.getByRole("button", { name: "+ Add room" }).click();
    await expect(page.getByRole("dialog", { name: "Add room" })).toBeVisible();
    await page.getByPlaceholder("Room #").fill(`9${smokeSuffix().slice(-3)}`);
    await pickAppSelectInDrawer(page, "Add room", 0, "Standard Double");
    await page.getByPlaceholder("Price/night").fill("5000");
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Guests — add drawer", async ({ page }) => {
    await openPmsTab(page, "Guests");
    await page.getByRole("button", { name: "+ Add guest" }).click();
    await expect(page.getByRole("dialog", { name: "New guest" })).toBeVisible();
    await page.getByLabel("Full name").fill(`Smoke Guest ${smokeSuffix()}`);
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Guest packages — recipes and package drawers", async ({ page }) => {
    await openPmsTab(page, "Guest packages");
    await expect(page.getByText("Full board (3 meals)").first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "+ New recipe" }).click();
    await expect(page.getByRole("dialog", { name: "New inclusion recipe" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();

    await page.getByRole("button", { name: "+ New package" }).click();
    await expect(page.getByRole("dialog", { name: "New guest package" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Rates — plan drawer; rules panel when plans exist", async ({ page }) => {
    await openPmsTab(page, "Rates");
    await page.getByRole("button", { name: "+ Add rate plan" }).click();
    await expect(page.getByRole("dialog", { name: "New rate plan" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();

    const rulesBtn = page.getByRole("button", { name: "Rules" }).first();
    if (await rulesBtn.isVisible().catch(() => false)) {
      await rulesBtn.click();
      await expect(page.getByText(/Rules for/)).toBeVisible();
    } else {
      await expect(page.getByText("No rate plans")).toBeVisible();
    }
  });
});

test.describe("Smoke — PMS operations", () => {
  test("New reservation — guest, dates, room quote", async ({ page }) => {
    await goto(page, "/pms");
    await page.getByRole("button", { name: "+ New reservation" }).click();
    await pickAppSelectInDrawer(page, "New reservation", 1, "John Smith");
    await page.locator('input[type="date"]').nth(0).fill("2026-08-01");
    await page.locator('input[type="date"]').nth(1).fill("2026-08-03");
    await pickAppSelectInDrawer(page, "New reservation", 2, /104/);
    await page.waitForResponse(
      (r) => r.url().includes("/pms/pricing/quote") && r.ok(),
      { timeout: 15_000 },
    );
    await expect(page.getByRole("dialog", { name: "New reservation" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Lifecycle — inquiry on 103 → confirm → check-in → check-out → vacant", async ({ page }) => {
    await goto(page, "/pms");
    const row = (status: string) =>
      page.getByRole("row").filter({
        hasText: "103",
        has: page.getByText(status, { exact: true }),
      });

    if (await row("INQUIRY").isVisible().catch(() => false)) {
      await row("INQUIRY").getByRole("button", { name: "Confirm" }).click();
      await expect(row("CONFIRMED")).toBeVisible({ timeout: 15_000 });
    }

    if (await row("CONFIRMED").isVisible().catch(() => false)) {
      await row("CONFIRMED").getByRole("button", { name: "Check in" }).click();
      await expect(row("CHECKED_IN")).toBeVisible({ timeout: 15_000 });
    }

    if (await row("CHECKED_IN").isVisible().catch(() => false)) {
      await row("CHECKED_IN").getByRole("button", { name: "Check out" }).click();
      await expect(row("CHECKED_OUT")).toBeVisible({ timeout: 15_000 });
    }

    await page.getByRole("tab", { name: "Rooms" }).click();
    const dirty = page.getByRole("row").filter({ hasText: "103" });
    if (await dirty.getByRole("cell", { name: "DIRTY" }).isVisible().catch(() => false)) {
      await dirty.getByRole("button", { name: "→ VACANT" }).click();
      await expect(dirty.getByRole("cell", { name: "VACANT" })).toBeVisible({ timeout: 10_000 });
    }
  });

  test("Record payment on reservation", async ({ page }) => {
    await goto(page, "/pms");
    await clickRowActionOnPage(page, "Fatima Khan", "Payment");
    await expect(page.getByRole("dialog", { name: "Record payment" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Guest inclusions drawer (checked-in)", async ({ page }) => {
    await goto(page, "/pms");
    const rahim = page.getByRole("row").filter({
      hasText: "Rahim Ahmed",
      has: page.getByText("CHECKED_IN", { exact: true }),
    });
    if ((await rahim.count()) === 0) return;

    await clickRowActionOnPage(page, "Rahim Ahmed", "Inclusions");
    await expect(page.getByRole("heading", { name: "Guest inclusions" })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "Close" }).click();
  });
});

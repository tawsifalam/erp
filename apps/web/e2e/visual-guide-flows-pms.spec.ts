/**
 * PMS step-by-step screenshots in dependency order (setup before operations).
 * Output: docs/visual/screenshots/flows/pms-*/
import { test, expect } from "@playwright/test";
import { pickAppSelectInDrawer } from "./helpers/app-select";
import { clickRowActionOnPage } from "./helpers/row-actions";
import {
  captureDrawerStep,
  captureFlowStep,
  resetFlowSteps,
} from "./helpers/visual-guide";
import { gotoApp, setupE2ePage } from "./helpers/setup";

test.describe.configure({ mode: "serial" });

async function openPmsTab(page: import("@playwright/test").Page, tab: string | RegExp) {
  await gotoApp(page, "/pms");
  await page.getByRole("tab", { name: tab }).click();
}

test.describe("Visual guide — PMS flows", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("PMS — room type (setup step 1)", async ({ page }) => {
    const flow = "pms-room-type";
    resetFlowSteps(flow);

    await openPmsTab(page, "Room types");
    await captureFlowStep(page, flow, "01-room-types-list", { fullPage: true });

    await page.getByRole("button", { name: "+ Add room type" }).click();
    await captureDrawerStep(page, flow, "02-drawer-empty", "New room type");

    await page.getByPlaceholder("Name").fill("Economy Twin");
    await page.getByLabel("Max adults").fill("2");
    await captureDrawerStep(page, flow, "03-fields-filled", "New room type");
  });

  test("PMS — room (setup step 2, needs room type)", async ({ page }) => {
    const flow = "pms-room";
    resetFlowSteps(flow);

    await openPmsTab(page, "Rooms");
    await captureFlowStep(page, flow, "01-rooms-list", { fullPage: true });

    await page.getByRole("button", { name: "+ Add room" }).click();
    await captureDrawerStep(page, flow, "02-drawer-empty", "Add room");

    await page.getByPlaceholder("Room #").fill("210");
    await pickAppSelectInDrawer(page, "Add room", 0, "Standard Double");
    await page.getByPlaceholder("Price/night").fill("5500");
    await captureDrawerStep(page, flow, "03-type-and-price-filled", "Add room");
  });

  test("PMS — guest (setup step 3)", async ({ page }) => {
    const flow = "pms-guest";
    resetFlowSteps(flow);

    await openPmsTab(page, "Guests");
    await captureFlowStep(page, flow, "01-guests-list", { fullPage: true });

    await page.getByRole("button", { name: "+ Add guest" }).click();
    await captureDrawerStep(page, flow, "02-drawer-empty", "New guest");

    await page.getByLabel("Full name").fill("Guide Guest");
    await page.getByLabel("Phone").fill("+8801700000000");
    await page.getByLabel("Email").fill("guide.guest@example.com");
    await captureDrawerStep(page, flow, "03-contact-filled", "New guest");
  });

  test("PMS — inclusion recipe (setup step 4a)", async ({ page }) => {
    const flow = "pms-inclusion-recipe";
    resetFlowSteps(flow);

    await openPmsTab(page, "Guest packages");
    await captureFlowStep(page, flow, "01-packages-and-recipes", { fullPage: true });

    await page.getByRole("button", { name: "+ New recipe" }).click();
    await captureDrawerStep(page, flow, "02-new-recipe-drawer", "New inclusion recipe");

    await page.getByLabel("Name").fill("Guide breakfast");
    await captureDrawerStep(page, flow, "03-recipe-name-filled", "New inclusion recipe");
  });

  test("PMS — guest package (setup step 4b, needs meal recipe)", async ({ page }) => {
    const flow = "pms-guest-package";
    resetFlowSteps(flow);

    await openPmsTab(page, "Guest packages");
    await captureFlowStep(page, flow, "01-existing-packages", { fullPage: true });

    await page.getByRole("button", { name: "+ New package" }).click();
    await captureDrawerStep(page, flow, "02-drawer-empty", "New guest package");

    await page.getByLabel("Package name").fill("Guide half board");
    await page.getByLabel("Meals per guest per night").fill("2");
    await pickAppSelectInDrawer(page, "New guest package", 0, "Standard guest meal");
    await captureDrawerStep(page, flow, "03-meal-allowance-filled", "New guest package");
  });

  test("PMS — rate plan and rules (setup step 5)", async ({ page }) => {
    const flow = "pms-rate-plan";
    resetFlowSteps(flow);

    await gotoApp(page, "/pms?tab=rates");
    await captureFlowStep(page, flow, "01-rates-list", { fullPage: true });

    await page.getByRole("button", { name: "+ Add rate plan" }).click();
    await captureDrawerStep(page, flow, "02-new-plan-drawer", "New rate plan");

    await page.getByLabel("Name").fill("Visual guide plan");
    await pickAppSelectInDrawer(page, "New rate plan", 0, "Standard Double");
    await page.getByLabel("Valid from").fill("2026-06-01");
    await page.getByLabel("Valid to").fill("2026-12-31");
    await page.getByLabel("Base modifier").fill("1.1");
    await pickAppSelectInDrawer(page, "New rate plan", 1, "Full board (3 meals)");
    await page.getByLabel("F&B supplement per guest per night").fill("800");
    await captureDrawerStep(page, flow, "03-plan-with-package", "New rate plan");
    await page.getByRole("button", { name: "Cancel" }).first().click();

    await page.getByRole("button", { name: "Rules" }).first().click();
    await expect(page.getByText(/Rules for/)).toBeVisible();
    await captureFlowStep(page, flow, "04-rules-panel", { fullPage: true });
  });

  test("PMS — new reservation (operations)", async ({ page }) => {
    const flow = "pms-new-reservation";
    resetFlowSteps(flow);

    await gotoApp(page, "/pms");
    await captureFlowStep(page, flow, "01-reservations-list", { fullPage: true });

    await page.getByRole("button", { name: "+ New reservation" }).click();
    await captureDrawerStep(page, flow, "02-drawer-empty", "New reservation");

    await pickAppSelectInDrawer(page, "New reservation", 1, "Karim Uddin");
    await captureDrawerStep(page, flow, "03-guest-selected", "New reservation");

    await page.locator('input[type="date"]').nth(0).fill("2026-07-10");
    await page.locator('input[type="date"]').nth(1).fill("2026-07-12");
    await captureDrawerStep(page, flow, "04-dates-set", "New reservation");

    await pickAppSelectInDrawer(page, "New reservation", 2, /102.*Standard/);
    await page.waitForResponse(
      (r) => r.url().includes("/pms/pricing/quote") && r.ok(),
      { timeout: 15_000 },
    );
    await captureDrawerStep(page, flow, "05-room-and-pricing", "New reservation");
  });

  test("PMS — reservation lifecycle", async ({ page }) => {
    const flow = "pms-reservation-lifecycle";
    resetFlowSteps(flow);

    await gotoApp(page, "/pms");
    await expect(page.getByRole("cell", { name: "INQUIRY" }).first()).toBeVisible();
    await captureFlowStep(page, flow, "01-inquiry-on-list", { fullPage: true });

    const lifecycleRow = (status: string) =>
      page.getByRole("row").filter({
        hasText: "102",
        has: page.getByText(status, { exact: true }),
      });

    await lifecycleRow("INQUIRY").getByRole("button", { name: "Confirm" }).click();
    await expect(lifecycleRow("CONFIRMED")).toBeVisible({ timeout: 10_000 });
    await captureFlowStep(page, flow, "02-confirmed", { fullPage: true });

    await lifecycleRow("CONFIRMED").getByRole("button", { name: "Check in" }).click();
    await expect(lifecycleRow("CHECKED_IN")).toBeVisible({ timeout: 10_000 });
    await captureFlowStep(page, flow, "03-checked-in", { fullPage: true });

    await lifecycleRow("CHECKED_IN").getByRole("button", { name: "Check out" }).click();
    await expect(lifecycleRow("CHECKED_OUT")).toBeVisible({ timeout: 10_000 });
    await captureFlowStep(page, flow, "04-checked-out", { fullPage: true });

    await page.getByRole("tab", { name: "Rooms" }).click();
    await expect(page.getByRole("cell", { name: "DIRTY" })).toBeVisible({ timeout: 10_000 });
    await captureFlowStep(page, flow, "05-room-dirty", { fullPage: true });

    const dirtyRoom = page.getByRole("row").filter({ hasText: "102" });
    await dirtyRoom.getByRole("button", { name: "→ VACANT" }).click();
    await expect(dirtyRoom.getByRole("cell", { name: "VACANT" })).toBeVisible({ timeout: 5000 });
    await captureFlowStep(page, flow, "06-room-vacant", { fullPage: true });
  });

  test("PMS — guest inclusions (checked-in)", async ({ page }) => {
    const flow = "pms-guest-inclusions";
    resetFlowSteps(flow);

    await gotoApp(page, "/pms");
    await clickRowActionOnPage(page, "CHECKED_IN", "Inclusions");
    await captureDrawerStep(page, flow, "01-inclusions-drawer", "Guest inclusions");
  });

  test("PMS — record payment", async ({ page }) => {
    const flow = "pms-record-payment";
    resetFlowSteps(flow);

    await gotoApp(page, "/pms");
    await captureFlowStep(page, flow, "01-list-before-payment", { fullPage: true });

    await clickRowActionOnPage(page, "Fatima Khan", "Payment");
    await captureDrawerStep(page, flow, "02-payment-drawer", "Record payment");

    await page.locator('input[type="number"]').last().fill("5000");
    await captureDrawerStep(page, flow, "03-amount-entered", "Record payment");
  });
});

import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";
import { acceptConfirmDialog } from "./helpers/confirm-dialog";
import { clickRowAction, clickRowActionOnPage } from "./helpers/row-actions";

test.describe("PMS – reservation lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("confirm inquiry → check-in → check-out → housekeeping", async ({ page }) => {
    await page.goto("/pms");

    await expect(page.getByRole("cell", { name: "INQUIRY" }).first()).toBeVisible();

    const lifecycleRow = (status: string) =>
      page.getByRole("row").filter({
        hasText: "102",
        has: page.getByText(status, { exact: true }),
      });

    await lifecycleRow("INQUIRY").getByRole("button", { name: "Confirm" }).click();
    await expect(lifecycleRow("CONFIRMED")).toBeVisible({ timeout: 10_000 });

    await lifecycleRow("CONFIRMED").getByRole("button", { name: "Check in" }).click();
    await expect(lifecycleRow("CHECKED_IN")).toBeVisible({ timeout: 10_000 });

    await lifecycleRow("CHECKED_IN").getByRole("button", { name: "Check out" }).click();
    await expect(lifecycleRow("CHECKED_OUT")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("tab", { name: "Rooms" }).click();
    await expect(page.getByRole("cell", { name: "DIRTY" })).toBeVisible({ timeout: 10_000 });
    const dirtyRoom = page.getByRole("row").filter({ hasText: "102" });
    await dirtyRoom.getByRole("button", { name: "→ VACANT" }).click();
    await expect(dirtyRoom.getByRole("cell", { name: "VACANT" })).toBeVisible({ timeout: 5000 });
  });

  test("edit confirmed reservation opens drawer", async ({ page }) => {
    await page.goto("/pms");
    await clickRowActionOnPage(page, "Fatima Khan", "Edit");
    await expect(page.getByRole("heading", { name: "Edit reservation" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("checked-in reservation shows inclusions drawer", async ({ page }) => {
    await page.goto("/pms");
    await clickRowActionOnPage(page, "CHECKED_IN", "Inclusions");
    const inclusions = page.getByRole("dialog", { name: "Guest inclusions" });
    await expect(inclusions).toBeVisible();
    await expect(inclusions.getByText("Breakfast meal", { exact: true })).toBeVisible();
    await expect(inclusions.getByText(/0 \/ 6 meals used/).first()).toBeVisible();
    await inclusions.getByRole("button", { name: "Record comp meal (1)" }).first().click();
    await expect(inclusions.getByText(/1 \/ 6 meals used/).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("guest packages tab lists demo packages", async ({ page }) => {
    await page.goto("/pms");
    await page.getByRole("tab", { name: "Guest packages" }).click();
    await expect(page.getByText("Full board (3 meals)").first()).toBeVisible();
    await expect(page.getByText("Budget (1 meal)").first()).toBeVisible();
  });

  test("new reservation drawer on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/pms");
    await page.getByRole("button", { name: "+ New reservation" }).click();
    await expect(page.getByRole("heading", { name: "New reservation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
  });
});

test.describe("PMS – delete and payment", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("record payment updates paid amount", async ({ page }) => {
    await page.goto("/pms");
    const row = page.getByRole("row").filter({ hasText: "Fatima Khan" });
    await clickRowAction(row, "Payment");
    await expect(page.getByRole("heading", { name: "Record payment" })).toBeVisible();

    const input = page.getByRole("spinbutton").last();
    await input.fill("10000");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(row.getByText(/10,?000/)).toBeVisible({ timeout: 5000 });
  });

  test("delete inquiry reservation removes row", async ({ page }) => {
    await page.goto("/pms");
    const inquiryRow = page.getByRole("row").filter({
      has: page.getByText("INQUIRY", { exact: true }),
    });
    await expect(inquiryRow).toHaveCount(1);
    await clickRowAction(inquiryRow, "Delete");
    await acceptConfirmDialog(page);
    await expect(page.getByRole("row").filter({ hasText: "INQUIRY" })).toHaveCount(0);
  });

  test("delete vacant room removes row", async ({ page }) => {
    await page.goto("/pms");
    await page.getByRole("tab", { name: "Rooms" }).click();
    const roomRow = page.getByRole("row").filter({ hasText: "102" });
    await expect(roomRow).toBeVisible();
    await roomRow.getByRole("button", { name: "Delete" }).click();
    await acceptConfirmDialog(page);
    await expect(page.getByRole("row").filter({ hasText: "102" })).toHaveCount(0);
  });

  test("delete unused room type removes row", async ({ page }) => {
    await page.goto("/pms");
    await page.getByRole("tab", { name: "Room types" }).click();
    const typeRow = page.getByRole("row").filter({ hasText: "Economy Single" });
    await expect(typeRow).toBeVisible();
    await typeRow.getByRole("button", { name: "Delete" }).click();
    await acceptConfirmDialog(page);
    await expect(page.getByRole("row").filter({ hasText: "Economy Single" })).toHaveCount(0);
  });

  test("delete guest with no reservations removes row", async ({ page }) => {
    await page.goto("/pms");
    await page.getByRole("tab", { name: "Guests" }).click();
    const guestRow = page.getByRole("row").filter({ hasText: "Karim Uddin" });
    await expect(guestRow).toBeVisible();
    await guestRow.getByRole("button", { name: "Delete" }).click();
    await acceptConfirmDialog(page);
    await expect(page.getByRole("row").filter({ hasText: "Karim Uddin" })).toHaveCount(0);
  });
});

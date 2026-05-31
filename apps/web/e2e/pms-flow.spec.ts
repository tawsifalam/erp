import { test, expect } from "@playwright/test";
import { mockAuth, mockApiRoutes } from "./helpers/auth";
import { acceptConfirmDialog } from "./helpers/confirm-dialog";

test.describe("PMS – reservation lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
  });

  test("confirm inquiry → check-in → check-out → housekeeping", async ({ page }) => {
    await page.goto("/pms");

    await expect(page.getByRole("cell", { name: "INQUIRY" }).or(page.getByText("INQUIRY"))).toBeVisible();

    const inquiryRow = page.getByRole("row").filter({ hasText: "INQUIRY" });
    await inquiryRow.getByRole("button", { name: "Confirm" }).click();
    await expect(inquiryRow.getByText("CONFIRMED")).toBeVisible({ timeout: 5000 });

    await inquiryRow.getByRole("button", { name: "Check in" }).click();
    await expect(inquiryRow.getByText("CHECKED_IN")).toBeVisible({ timeout: 5000 });

    await inquiryRow.getByRole("button", { name: "Check out" }).click();
    await expect(inquiryRow.getByText("CHECKED_OUT")).toBeVisible({ timeout: 5000 });

    await page.getByRole("tab", { name: "Rooms" }).click();
    const dirtyRoom = page.getByRole("row").filter({ hasText: "DIRTY" });
    await expect(dirtyRoom).toBeVisible();
    await dirtyRoom.getByRole("button", { name: "→ VACANT" }).click();
    await expect(dirtyRoom.getByText("VACANT")).toBeVisible({ timeout: 5000 });
  });

  test("edit confirmed reservation opens modal", async ({ page }) => {
    await page.goto("/pms");
    const row = page.getByRole("row").filter({ hasText: "Fatima Khan" });
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByText("Edit reservation")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("checked-in reservation shows inclusions panel", async ({ page }) => {
    await page.goto("/pms");
    const row = page.getByRole("row").filter({ hasText: "Rahim Ahmed" });
    await row.getByRole("button", { name: "Inclusions" }).click();
    await expect(page.getByText("Guest inclusions")).toBeVisible();
    await expect(page.getByText(/meals used/)).toBeVisible();
    await page.getByRole("button", { name: "Record comp meal (1)" }).click();
    await expect(page.getByText(/1 \/ 18 meals used/)).toBeVisible({ timeout: 5000 });
  });

  test("guest packages tab lists demo packages", async ({ page }) => {
    await page.goto("/pms");
    await page.getByRole("tab", { name: "Guest packages" }).click();
    await expect(page.getByText("Full board (3 meals)")).toBeVisible();
    await expect(page.getByText("Budget (1 meal)")).toBeVisible();
  });
});

test.describe("PMS – delete and payment", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockApiRoutes(page);
  });

  test("record payment updates paid amount", async ({ page }) => {
    await page.goto("/pms");
    const row = page.getByRole("row").filter({ hasText: "Fatima Khan" });
    await row.getByRole("button", { name: "Payment" }).click();
    await expect(page.getByText("Record payment")).toBeVisible();

    const input = page.locator('input[type="number"]').last();
    await input.fill("10000");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(row.getByText(/10,?000/)).toBeVisible({ timeout: 5000 });
  });

  test("delete inquiry reservation removes row", async ({ page }) => {
    await page.goto("/pms");
    const inquiryRow = page.getByRole("row").filter({ hasText: "INQUIRY" });
    await expect(inquiryRow).toHaveCount(1);
    await inquiryRow.getByRole("button", { name: "Delete" }).click();
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

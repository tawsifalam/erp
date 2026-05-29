import { test, expect } from "@playwright/test";
import { mockAuth, mockApiRoutes } from "./helpers/auth";

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

  test("edit room opens modal on Rooms tab", async ({ page }) => {
    await page.goto("/pms");
    await page.getByRole("tab", { name: "Rooms" }).click();
    await page.getByRole("button", { name: "Edit" }).first().click();
    await expect(page.getByText("Edit room")).toBeVisible();
  });
});

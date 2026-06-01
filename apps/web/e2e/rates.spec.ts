import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";
import { pickAppSelectInDrawer } from "./helpers/app-select";
import { clickRowAction } from "./helpers/row-actions";

test.describe("PMS rate plans", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("rates tab lists seed plan with weekend rule", async ({ page }) => {
    await page.goto("/pms?tab=rates");
    await expect(page.getByRole("tab", { name: "Rates" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Summer standard" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("cell", { name: "Summer standard" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Standard Double" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Rules" }).first().click();
    await expect(page.getByRole("cell", { name: "Saturday" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "৳5,000" })).toBeVisible();
  });

  test("can create a new rate plan", async ({ page }) => {
    await page.goto("/pms?tab=rates");
    await expect(page.getByRole("cell", { name: "Summer standard" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "+ Add rate plan" }).click();
    await expect(page.getByRole("heading", { name: "New rate plan" })).toBeVisible();
    await page.getByLabel("Name").fill("Winter promo");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("cell", { name: "Winter promo" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("full board rate plan adds F&B supplement to weekday quote", async ({ page }) => {
    await page.goto("/pms");
    await page.getByRole("button", { name: "+ New reservation" }).click();
    await pickAppSelectInDrawer(page, "New reservation", 1, "Karim Uddin");
    await page.locator('input[type="date"]').nth(0).fill("2026-06-02");
    await page.locator('input[type="date"]').nth(1).fill("2026-06-04");
    await pickAppSelectInDrawer(page, "New reservation", 2, /102.*Standard/);
    await page.waitForResponse(
      (r) => r.url().includes("/pms/pricing/quote") && r.ok(),
      { timeout: 15_000 },
    );
    await expect(page.getByText(/Rate plan: Summer full board/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("reservation-total-amount")).toHaveValue("10200", {
      timeout: 10_000,
    });
  });

  test("weekend stay quotes higher total than weekday in reservation drawer", async ({
    page,
  }) => {
    await page.goto("/pms");
    await page.getByRole("button", { name: "+ New reservation" }).click();
    await pickAppSelectInDrawer(page, "New reservation", 1, "Karim Uddin");
    await page.locator('input[type="date"]').nth(0).fill("2026-06-05");
    await page.locator('input[type="date"]').nth(1).fill("2026-06-07");
    await pickAppSelectInDrawer(page, "New reservation", 2, /102.*Standard/);
    await page.waitForResponse(
      (r) => r.url().includes("/pms/pricing/quote") && r.ok(),
      { timeout: 15_000 },
    );
    await expect(page.getByText(/Rate plan:/i)).toBeVisible({
      timeout: 10_000,
    });
    const totalInput = page.getByTestId("reservation-total-amount");
    await expect(totalInput).toHaveValue("8500", { timeout: 10_000 });

    await page.locator('input[type="date"]').nth(0).fill("2026-06-02");
    await page.locator('input[type="date"]').nth(1).fill("2026-06-04");
    await expect(totalInput).toHaveValue("7000", { timeout: 10_000 });
  });

  test("creating reservation uses quoted total in table", async ({ page }) => {
    await page.goto("/pms");
    await page.getByRole("button", { name: "+ New reservation" }).click();
    await pickAppSelectInDrawer(page, "New reservation", 1, "Karim Uddin");
    await page.locator('input[type="date"]').nth(0).fill("2026-07-10");
    await page.locator('input[type="date"]').nth(1).fill("2026-07-12");
    await pickAppSelectInDrawer(page, "New reservation", 2, /102.*Standard/);
    await page.waitForResponse(
      (r) => r.url().includes("/pms/pricing/quote") && r.ok(),
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("reservation-total-amount")).toHaveValue("7000", {
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("row").filter({ hasText: "Karim Uddin" }).getByText("7,000")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("editing reservation dates recalculates total", async ({ page }) => {
    await page.goto("/pms");
    const row = page
      .getByRole("row")
      .filter({ hasText: "INQUIRY" })
      .filter({ hasText: "102" });
    await clickRowAction(row, "Edit");
    await expect(page.getByRole("heading", { name: "Edit reservation" })).toBeVisible();
    await page.locator('input[type="date"]').nth(0).fill("2026-06-05");
    await page.locator('input[type="date"]').nth(1).fill("2026-06-07");
    await page.waitForResponse(
      (r) => r.url().includes("/pms/pricing/quote") && r.ok(),
      { timeout: 15_000 },
    );
    const totalInput = page.getByTestId("reservation-total-amount");
    await expect(totalInput).toHaveValue("8500", { timeout: 10_000 });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(row.getByText("8,500")).toBeVisible({ timeout: 10_000 });
  });
});

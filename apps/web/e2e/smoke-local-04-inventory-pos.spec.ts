/**
 * Inventory, POS, kitchen (runbook §4).
 */
import { test } from "@playwright/test";
import { pickAppSelectInDrawer } from "./helpers/app-select";
import { useSmokeHarness } from "./helpers/smoke-local.harness";

const { goto, expect } = useSmokeHarness();

test.describe("Smoke — Inventory", () => {
  test("Items — new item drawer", async ({ page }) => {
    await goto(page, "/inventory");
    await page.getByRole("button", { name: "+ New item" }).click();
    await expect(page.getByRole("dialog", { name: "New inventory item" })).toBeVisible();
    await page.getByPlaceholder("Name").fill("Smoke Tomatoes");
    await page.getByPlaceholder("SKU").fill(`SMK-${Date.now().toString().slice(-6)}`);
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Record movement drawer", async ({ page }) => {
    await goto(page, "/inventory");
    await page.getByRole("button", { name: "+ Record movement" }).click();
    await expect(page.getByRole("dialog", { name: "Record movement" })).toBeVisible();
    await pickAppSelectInDrawer(page, "Record movement", 0, /Rice \(INV-001\)/);
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Recipes (BOM) — edit recipe drawer", async ({ page }) => {
    await goto(page, "/inventory");
    await page.getByRole("tab", { name: "Recipes (BOM)" }).click();
    await page.getByRole("button", { name: "Edit recipe" }).first().click();
    await expect(page.getByRole("dialog", { name: "Bill of materials" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });
});

test.describe("Smoke — POS & kitchen", () => {
  test("POS — draft order send to kitchen", async ({ page }) => {
    await goto(page, "/pos");
    const draftRow = page.getByRole("row").filter({ hasText: "T5" });
    if (await draftRow.isVisible().catch(() => false)) {
      await draftRow.getByRole("button", { name: "Send to kitchen" }).click();
      await expect(draftRow.getByText("SUBMITTED", { exact: true })).toBeVisible({
        timeout: 15_000,
      });
    } else {
      await expect(page.getByRole("row").nth(1)).toBeVisible();
    }
  });

  test("POS — complete and pay drawer on submitted order", async ({ page }) => {
    await goto(page, "/pos");
    const submitted = page.getByRole("row").filter({ hasText: "T1" });
    if (await submitted.isVisible().catch(() => false)) {
      await submitted.getByRole("button", { name: "Complete & Pay" }).click();
      await expect(page.getByRole("dialog", { name: /Complete & pay/i })).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).first().click();
    }
  });

  test("POS — menu category drawer", async ({ page }) => {
    await goto(page, "/pos");
    await page.getByRole("tab", { name: "Menu" }).click();
    await page.getByRole("button", { name: "+ Add category" }).click();
    await expect(page.getByText("New category")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Kitchen display — queue visible", async ({ page }) => {
    await goto(page, "/pos/kitchen");
    await expect(page.getByRole("heading", { name: /Kitchen display/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to POS/i })).toBeVisible();
  });
});

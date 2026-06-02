/**
 * Settings: organization, branches, team, pools, audit (runbook §1 UI subset).
 */
import { test } from "@playwright/test";
import { pickAppSelectInDrawer } from "./helpers/app-select";
import { smokeSuffix, useSmokeHarness } from "./helpers/smoke-local.harness";

const { goto, expect } = useSmokeHarness();

test.describe("Smoke — Settings", () => {
  test("Organization tab — name and branches list", async ({ page }) => {
    await goto(page, "/settings");
    await expect(page.getByRole("tab", { name: /Organization/i })).toBeVisible();
    await expect(page.getByText("Current organization")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Main Hotel & Restaurant" })).toBeVisible();
  });

  test("Add branch drawer (create)", async ({ page }) => {
    const name = `Smoke Branch ${smokeSuffix()}`;
    await goto(page, "/settings");
    await page.getByRole("button", { name: "+ Add branch" }).click();
    await expect(page.getByRole("dialog", { name: /Add branch/i })).toBeVisible();
    await page.getByPlaceholder("Branch name").fill(name);
    await page.getByRole("button", { name: "Create branch" }).click();
    await expect(page.getByText(/Branch created/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("cell", { name })).toBeVisible();
  });

  test("Team tab — join code and invite form", async ({ page }) => {
    await goto(page, "/settings?tab=team");
    await expect(page.getByRole("tab", { name: /Team/i })).toBeVisible();
    await expect(page.getByText("Organization join code")).toBeVisible();
    await page.getByPlaceholder("colleague@example.com").fill(`smoke-${smokeSuffix()}@example.com`);
    await expect(page.getByRole("button", { name: /invite/i })).toBeVisible();
  });

  test("Inventory pools tab", async ({ page }) => {
    await goto(page, "/settings?tab=pools");
    await expect(page.getByRole("tab", { name: "Inventory pools", selected: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add pool" }).first()).toBeVisible();
    await page.getByRole("button", { name: "+ Add pool" }).click();
    await expect(page.getByRole("dialog", { name: "Add inventory pool" })).toBeVisible();
    const code = `smk${smokeSuffix().slice(-4)}`;
    await page.getByPlaceholder("Code (e.g. minibar)").fill(code);
    await page.getByPlaceholder("Display name").fill("Smoke pool");
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Audit log tab", async ({ page }) => {
    await goto(page, "/settings?tab=audit");
    await expect(page.getByRole("tab", { name: /Audit/i })).toBeVisible();
    await expect(page.getByRole("table").first()).toBeVisible({ timeout: 15_000 });
  });
});

/**
 * Settings module UI: org/branches, team, pools, audit, integrations (real stack).
 * Runbook §1 (email invite) and §2 (join code) remain manual — see smoke-local.md.
 */
import { test } from "@playwright/test";
import { pickAppSelectInDrawer } from "./helpers/app-select";
import {
  SMOKE_SEED_BRANCH_NAME,
  SMOKE_SEED_ORG_NAME,
  smokeSuffix,
  useSmokeHarness,
} from "./helpers/smoke-local.harness";

const { goto, expect } = useSmokeHarness();

let smokeBranchName = "";

test.describe("Smoke — Settings", () => {
  test("Organization tab — name and branches list", async ({ page }) => {
    await goto(page, "/settings");
    await expect(page.getByRole("tab", { name: /Organization/i })).toBeVisible();
    await expect(page.getByText("Current organization")).toBeVisible();
    await expect(page.getByRole("cell", { name: SMOKE_SEED_BRANCH_NAME })).toBeVisible();
  });

  test("Save organization name — rename and revert", async ({ page }) => {
    const renamed = `Smoke Org ${smokeSuffix()}`;
    await goto(page, "/settings");
    const nameInput = page.getByRole("textbox", { name: /organization name/i }).first();
    await nameInput.fill(renamed);
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText(/Organization updated/i)).toBeVisible();
    await expect(nameInput).toHaveValue(renamed);

    await nameInput.fill(SMOKE_SEED_ORG_NAME);
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText(/Organization updated/i)).toBeVisible();
    await expect(nameInput).toHaveValue(SMOKE_SEED_ORG_NAME);
  });

  test("Add branch — create", async ({ page }) => {
    smokeBranchName = `Smoke Branch ${smokeSuffix()}`;
    await goto(page, "/settings");
    await page.getByRole("button", { name: "+ Add branch" }).click();
    await expect(page.getByRole("dialog", { name: /Add branch/i })).toBeVisible();
    await page.getByPlaceholder("Branch name").fill(smokeBranchName);
    await page.getByRole("button", { name: "Create branch" }).click();
    await expect(page.getByText(/Branch created/i)).toBeVisible();
    await expect(page.getByRole("cell", { name: smokeBranchName })).toBeVisible();
  });

  test("Edit branch — inline timezone save", async ({ page }) => {
    test.skip(!smokeBranchName, "Requires branch from prior test");
    await goto(page, "/settings");
    const branchesPanel = page.getByRole("tabpanel", { name: "Organization & branches" });
    const row = branchesPanel.getByRole("row", { name: new RegExp(smokeBranchName) });
    await row.getByRole("textbox").nth(1).fill("Asia/Kolkata");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/Branch updated/i)).toBeVisible();
    await expect(row.getByRole("textbox").nth(1)).toHaveValue("Asia/Kolkata");
  });

  test("Team tab — join code and invite form", async ({ page }) => {
    await goto(page, "/settings?tab=team");
    await expect(page.getByRole("tab", { name: /Team/i })).toBeVisible();
    await expect(page.getByText("Organization join code")).toBeVisible();
    await page.getByPlaceholder("colleague@example.com").fill(`smoke-${smokeSuffix()}@example.com`);
    await expect(page.getByRole("button", { name: /invite/i })).toBeVisible();
  });

  test("Inventory pools — default guest and staff pools", async ({ page }) => {
    await goto(page, "/settings?tab=pools");
    await expect(page.getByRole("tab", { name: "Inventory pools", selected: true })).toBeVisible();
    const poolsPanel = page.getByRole("tabpanel", { name: "Inventory pools" });
    await expect(poolsPanel.getByRole("cell", { name: "guest(system)" })).toBeVisible();
    await expect(poolsPanel.getByRole("cell", { name: "staff(system)" })).toBeVisible();
  });

  test("Inventory pools — create custom pool", async ({ page }) => {
    const code = `smk${smokeSuffix().slice(-4)}`;
    const displayName = `Smoke pool ${smokeSuffix()}`;
    await goto(page, "/settings?tab=pools");
    await page.getByRole("button", { name: "+ Add pool" }).click();
    await expect(page.getByRole("dialog", { name: "Add inventory pool" })).toBeVisible();
    await page.getByPlaceholder("Code (e.g. minibar)").fill(code);
    await page.getByPlaceholder("Display name").fill(displayName);
    await page.getByRole("button", { name: "Create pool" }).click();
    await expect(page.getByText(/Inventory pool created/i)).toBeVisible();
    await expect(page.getByRole("cell", { name: code })).toBeVisible();
    await expect(page.getByRole("cell", { name: displayName })).toBeVisible();
  });

  test("Audit log tab", async ({ page }) => {
    await goto(page, "/settings?tab=audit");
    await expect(page.getByRole("tab", { name: /Audit/i })).toBeVisible();
    await expect(page.getByRole("table").first()).toBeVisible();
  });

  test("Notifications tab — toggle in-app preference", async ({ page }) => {
    await goto(page, "/settings?tab=notifications");
    await expect(page.getByRole("tab", { name: "Notifications", selected: true })).toBeVisible();
    await expect(page.getByText("Low stock alerts")).toBeVisible();
    const checkbox = page.getByRole("checkbox", { name: "Report ready in-app" });
    await expect(checkbox).toBeVisible();
    const wasChecked = await checkbox.isChecked();
    await checkbox.setChecked(!wasChecked);
    await expect(page.getByText(/Notification preference saved/i)).toBeVisible();
    await checkbox.setChecked(wasChecked);
    await expect(page.getByText(/Notification preference saved/i)).toBeVisible();
  });

  test("Branch access tab — member list", async ({ page }) => {
    await goto(page, "/settings?tab=branch-access");
    await expect(page.getByRole("tab", { name: "Branch access", selected: true })).toBeVisible();
    await expect(page.getByText("Grant org members access")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Member" })).toBeVisible();
  });

  test("Integrations tab — adapter registry", async ({ page }) => {
    await goto(page, "/settings?tab=integrations");
    await expect(page.getByRole("tab", { name: "Integrations", selected: true })).toBeVisible();
    await expect(page.getByText("Adapter registry", { exact: true })).toBeVisible();
    await expect(page.getByText("(generic_webhook)", { exact: true })).toBeVisible();
    await expect(page.getByText("(channel_manager)", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add connection" })).toBeVisible();
  });

  test("Channel manager — export availability on connection", async ({ page }) => {
    await goto(page, "/settings?tab=integrations");
    await page.getByRole("button", { name: "+ Add connection" }).click();
    await expect(page.getByRole("dialog", { name: "Add integration connection" })).toBeVisible();
    await page.getByPlaceholder("Booking.com — Main").fill(`Smoke Channel ${smokeSuffix()}`);
    await pickAppSelectInDrawer(page, "Add integration connection", 0, "Channel manager");
    await pickAppSelectInDrawer(page, "Add integration connection", 1, SMOKE_SEED_BRANCH_NAME);
    await page.getByRole("button", { name: "Create connection" }).click();
    await expect(page.getByText(/Integration connection created/i)).toBeVisible();
    const dismissSecret = page.getByRole("button", { name: "Dismiss", exact: true });
    if (await dismissSecret.isVisible().catch(() => false)) {
      await dismissSecret.click();
    }
    await expect(page.getByText("Channel manager", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Export availability" }).click();
    await expect(page.getByText(/Availability exported/i)).toBeVisible();
  });
});

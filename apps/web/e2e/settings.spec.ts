import { test, expect } from "@playwright/test";
import { FAKE_BRANCH_ID_2 } from "./helpers/auth";
import { setupE2ePage } from "./helpers/setup";

test.describe("Settings – Organization & branch management", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("loads settings page with organization and branches", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("tab", { name: /Organization & branches/i })).toBeVisible();
    await expect(page.getByText("Current organization")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Main Branch" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Annex Branch" })).toBeVisible();
  });

  test("can add a new branch and see it in the table", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "+ Add branch" }).click();
    await page.getByPlaceholder("Branch name").fill("Rooftop Bar");
    await page.getByRole("button", { name: "Create branch" }).click();
    await expect(page.getByText(/Branch created/i)).toBeVisible();
    await expect(page.getByRole("cell", { name: "Rooftop Bar" })).toBeVisible();
  });

  test("can delete a branch after confirmation", async ({ page }) => {
    await page.goto("/settings");
    const branchesPanel = page.getByRole("tabpanel", { name: "Organization & branches" });
    const annexRow = branchesPanel.getByRole("row", { name: /Annex Branch/ });
    await annexRow.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Annex Branch");
    const deleteDone = page.waitForResponse(
      (res) =>
        res.request().method() === "DELETE" &&
        res.url().includes(`/tenants/branches/${FAKE_BRANCH_ID_2}`),
    );
    await page.getByTestId("confirm-dialog-confirm").click();
    const deleteResponse = await deleteDone;
    expect(deleteResponse.ok()).toBeTruthy();
    await expect(page.getByText(/Branch deleted/i)).toBeVisible();
    await page.goto("/settings");
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByRole("cell", { name: "Annex Branch", exact: true })).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(page.getByRole("cell", { name: "Main Branch", exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("cannot delete the only remaining branch", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("cell", { name: "Main Branch", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Annex Branch", exact: true })).toBeVisible();

    const annexRow = page.getByRole("row", {
      has: page.getByRole("cell", { name: "Annex Branch", exact: true }),
    });
    await annexRow.getByRole("button", { name: "Delete" }).first().click();
    await page.getByTestId("confirm-dialog-confirm").click();
    await expect(page.getByText(/Branch deleted/i)).toBeVisible();

    await page.goto("/settings");
    const mainRow = page.getByRole("row", {
      has: page.getByRole("cell", { name: "Main Branch", exact: true }),
    });
    await expect(mainRow.getByRole("button", { name: "Delete" }).first()).toBeDisabled();
  });

  test("can save organization name", async ({ page }) => {
    await page.goto("/settings");
    const nameInput = page.getByRole("textbox", { name: /organization name/i }).first();
    await nameInput.fill("Boulevard Group");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText(/Organization updated/i)).toBeVisible();
    await expect(nameInput).toHaveValue("Boulevard Group");
  });

  test("inventory pools tab lists default pools", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: /Inventory pools/i }).click();
    const poolsPanel = page.getByRole("tabpanel", { name: "Inventory pools" });
    await expect(poolsPanel).toBeVisible();
    await expect(poolsPanel.getByRole("cell", { name: /guest/ })).toBeVisible();
    await expect(poolsPanel.getByRole("cell", { name: /staff/ })).toBeVisible();
  });

  test("settings link appears in navigation", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  });

  test("deep-link opens team and access tab with breadcrumb", async ({ page }) => {
    await page.goto("/settings?tab=team");
    await expect(page.getByTestId("app-breadcrumbs")).toContainText("Team & access");
    await expect(page.getByText("Organization join code")).toBeVisible();
  });
});

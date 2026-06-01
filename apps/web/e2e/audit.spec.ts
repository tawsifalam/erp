import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";
import { pickAppSelectInDrawer } from "./helpers/app-select";
import { auditPanel, auditTable, filterAuditByEntity } from "./helpers/audit";
import { showAllPosOrders } from "./helpers/pos";

test.describe("Audit log", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("tab loads and shows empty state when no entries", async ({ page }) => {
    await page.goto("/settings?tab=audit");
    await expect(page.getByRole("tab", { name: "Audit log" })).toBeVisible();
    await expect(page.getByText("Recent activity")).toBeVisible();
    await expect(auditPanel(page).getByText("No audit entries")).toBeVisible();
  });

  test("deleting a branch records a DELETE branch entry", async ({ page }) => {
    await page.goto("/settings");
    const branchesPanel = page.getByRole("tabpanel", { name: "Organization & branches" });
    const annexRow = branchesPanel.getByRole("row", { name: /Annex Branch/ });
    await annexRow.getByRole("button", { name: "Delete" }).click();
    await page.getByTestId("confirm-dialog-confirm").click();
    await expect(page.getByText(/Branch deleted/i)).toBeVisible();

    await page.goto("/settings?tab=audit");
    const table = auditTable(page);
    await expect(table.getByRole("cell", { name: "DELETE" })).toBeVisible();
    await expect(table.getByRole("row").filter({ hasText: "branch" }).first()).toBeVisible();
    await expect(table.getByText(/Annex Branch/)).toBeVisible();
  });

  test("entity type filter limits rows to reservations", async ({ page }) => {
    await page.goto("/pms");
    const lifecycleRow = (status: string) =>
      page.getByRole("row").filter({
        hasText: "102",
        has: page.getByText(status, { exact: true }),
      });

    await lifecycleRow("INQUIRY").getByRole("button", { name: "Confirm" }).click();
    await lifecycleRow("CONFIRMED").getByRole("button", { name: "Check in" }).click();
    await expect(lifecycleRow("CHECKED_IN")).toBeVisible({ timeout: 10_000 });

    await page.goto("/settings?tab=audit");
    await filterAuditByEntity(page, "Reservation");

    const table = auditTable(page);
    await expect(table.getByRole("cell", { name: "UPDATE" }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(table.getByRole("row").filter({ hasText: "reservation" }).first()).toBeVisible();
    await expect(table.getByRole("row").filter({ hasText: "branch" })).toHaveCount(0);
  });

  test("inventory purchase movement appears in audit log", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: "+ Record movement" }).click();
    await pickAppSelectInDrawer(page, "Record movement", 0, /Basmati Rice/);
    await page.locator('input[type="number"]').first().fill("5");
    await page.getByRole("button", { name: "Record", exact: true }).click();
    await expect(page.getByRole("cell", { name: "125.00" })).toBeVisible({ timeout: 10_000 });

    await page.goto("/settings?tab=audit");
    const table = auditTable(page);
    await expect(table.getByRole("row").filter({ hasText: "inventory_movement" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(table.getByRole("cell", { name: "CREATE" }).first()).toBeVisible();
  });

  test("adding an employee records CREATE employee entry", async ({ page }) => {
    await page.goto("/hr");
    await page.getByRole("button", { name: "+ Add employee" }).click();
    await page.getByPlaceholder("Name").fill("Audit Test Worker");
    await page.getByPlaceholder("Designation").fill("Tester");
    await page.getByPlaceholder("Salary").fill("30000");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByText(/Employee added/i)).toBeVisible({ timeout: 10_000 });

    await page.goto("/settings?tab=audit");
    const table = auditTable(page);
    await expect(
      table.getByRole("row").filter({ hasText: "employee" }).filter({ hasText: "CREATE" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(table.getByText(/Audit Test Worker/)).toBeVisible();
  });

  test("completing a POS order records order audit entry", async ({ page }) => {
    await page.goto("/pos");
    const row = page.getByRole("row").filter({ hasText: "T-3" });
    await row.getByRole("button", { name: "Complete & Pay" }).click();
    await page.getByRole("button", { name: "Complete" }).click();
    await showAllPosOrders(page);
    await expect(row.getByText("COMPLETED", { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.goto("/settings?tab=audit");
    const table = auditTable(page);
    await expect(
      table.getByRole("row").filter({ hasText: "order" }).filter({ hasText: "UPDATE" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(table.getByText(/COMPLETED/)).toBeVisible();
  });
});

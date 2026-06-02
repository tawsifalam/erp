/**
 * Local production smoke — real API, Postgres, PropelAuth token (no route mocks on :3001).
 * Prereq: docker (postgres/redis/minio), pnpm db:reset, pnpm smoke:local:setup
 */
import { test, expect } from "@playwright/test";
import { pickAppSelectInDrawer } from "./helpers/app-select";
import {
  gotoAppRealStack,
  loadSmokeAuth,
  setupRealStackPage,
  type SmokeAuth,
} from "./helpers/smoke-setup";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

test.describe.configure({ mode: "serial" });

test.describe("Local smoke — real stack", () => {
  test.skip(
    () => !!process.env.CI && !process.env.SMOKE_PROPELAUTH_USER_ID,
    "CI runs mocked e2e only; set secrets to enable smoke-local in CI",
  );

  let auth: SmokeAuth;

  test.beforeAll(async () => {
    auth = await loadSmokeAuth();
  });

  test.beforeEach(async ({ page }) => {
    await setupRealStackPage(page, auth);
  });

  test("P0 — API health", async ({ request }) => {
    const res = await request.get(`${apiBase}/api/health`);
    expect(res.ok()).toBeTruthy();
  });

  test("P1 — dashboard loads with seed data", async ({ page }) => {
    await gotoAppRealStack(page, "/dashboard");
    await expect(page.getByRole("heading", { name: /Overview/i })).toBeVisible();
    await expect(page.getByText("Occupancy", { exact: true })).toBeVisible();
  });

  test("Flow 3 — procurement PO receive", async ({ page }) => {
    await gotoAppRealStack(page, "/procurement");

    const vendorsPanel = page.getByRole("tabpanel", { name: "Vendors" });
    const vendorCells = vendorsPanel.getByRole("cell", { name: "Fresh Foods Ltd" });
    if ((await vendorCells.count()) === 0) {
      await vendorsPanel.getByRole("button", { name: "+ Add vendor" }).click();
      await page.getByLabel("Name").fill("Fresh Foods Ltd");
      await page.getByLabel("Contact").fill("Rashid");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(vendorCells.first()).toBeVisible({ timeout: 15_000 });
    }

    await page.getByRole("tab", { name: "Purchase orders" }).click();
    await page.getByRole("button", { name: "+ New PO" }).click();
    await pickAppSelectInDrawer(page, "New purchase order", 0, "Fresh Foods Ltd");
    await pickAppSelectInDrawer(page, "New purchase order", 1, /Rice \(INV-001\)/);
    await page.getByLabel("Quantity").fill("5");
    await page.getByLabel("Unit price").fill("99");
    await page.getByRole("button", { name: "Create & submit" }).click();
    await expect(page.getByText(/Purchase order created/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Receive" }).first().click();
    const receiveDrawer = page.getByRole("dialog", { name: "Receive goods" });
    await pickAppSelectInDrawer(page, "Receive goods", 0, /Rice \(remaining/);
    await receiveDrawer.locator('input[type="number"]').fill("5");
    await receiveDrawer.getByRole("button", { name: "Receive" }).click();
    await expect(page.getByText(/Goods received/i)).toBeVisible({ timeout: 15_000 });
  });

  test("Flow 4 — accounting shows journals after activity", async ({ page }) => {
    await gotoAppRealStack(page, "/accounting");
    await expect(page.getByRole("tab", { name: "Journal entries" })).toBeVisible();
    await expect(page.getByRole("row").nth(1)).toBeVisible({ timeout: 15_000 });
  });

  test("Flow 6 — PMS rates tab and reservation drawer", async ({ page }) => {
    await gotoAppRealStack(page, "/pms?tab=rates");
    await expect(page.getByRole("button", { name: "+ Add rate plan" })).toBeVisible();

    await page.getByRole("tab", { name: "Reservations" }).click();
    await page.getByRole("button", { name: "+ New reservation" }).click();
    await expect(page.getByRole("dialog", { name: "New reservation" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();
  });

  test("Flow 7 — queue profit and loss report", async ({ page }) => {
    await gotoAppRealStack(page, "/reports");
    const hidden = page.locator("select").filter({
      has: page.locator('option[value="profit_and_loss"]'),
    });
    await hidden.selectOption("profit_and_loss", { force: true });
    await expect(page.getByText("From")).toBeVisible();
    await page.getByRole("button", { name: "Export CSV" }).first().click();
    await expect(page.getByText(/Export queued/i)).toBeVisible({ timeout: 15_000 });
  });
});

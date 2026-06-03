import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";
import { E2E_ORG_ID } from "./helpers/audit-state";
import {
  createIntegrationConnection,
  type MockIntegrationConnection,
} from "./helpers/integrations-state";

function isIntegrationError(
  result: unknown,
): result is { status: number; message: string } {
  return (
    !!result &&
    typeof result === "object" &&
    "status" in result &&
    typeof (result as { status: unknown }).status === "number" &&
    (result as { status: number }).status >= 400
  );
}

test.describe("Channel manager", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("channel panel exports availability and adds block", async ({ page }) => {
    const created = createIntegrationConnection(E2E_ORG_ID, {
      adapterKey: "channel_manager",
      name: "Booking.com",
      branchId: "branch-test-001",
    });
    if (isIntegrationError(created)) throw new Error(created.message);
    const conn = created as MockIntegrationConnection & { webhookSecret: string };

    await page.goto("/settings?tab=integrations");
    await page.getByRole("cell", { name: "Booking.com" }).click();
    await expect(
      page.getByText("Channel manager", { exact: true }).first(),
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Export availability" }).click();
    await expect(page.getByText(/Availability exported/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("channel-export-summary")).toBeVisible();

    await page.getByLabel("Block start").fill("2026-09-01");
    await page.getByLabel("Block end").fill("2026-09-05");
    await page.getByPlaceholder("Renovation").fill("Maintenance");
    const blockSave = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().includes("/availability-blocks") &&
        res.ok(),
    );
    await page.getByRole("button", { name: "Add block" }).click();
    await blockSave;
    await expect(page.getByText(/Availability block added/i)).toBeVisible({ timeout: 5000 });
  });
});

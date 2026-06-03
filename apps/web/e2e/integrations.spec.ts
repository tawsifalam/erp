import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";
import {
  createIntegrationConnection,
  getMockWebhookEvents,
  handleIntegrationWebhook,
  type MockIntegrationConnection,
} from "./helpers/integrations-state";
import { E2E_ORG_ID } from "./helpers/audit-state";

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

test.describe("Integrations", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("integrations tab lists adapters and creates connection", async ({ page }) => {
    await page.goto("/settings?tab=integrations");
    await expect(page.getByRole("tab", { name: "Integrations", selected: true })).toBeVisible();
    await expect(page.getByText("Adapter registry", { exact: true })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("(generic_webhook)", { exact: true })).toBeVisible();
    await expect(page.getByText("(channel_manager)", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "+ Add connection" }).click();
    await expect(page.getByRole("dialog", { name: "Add integration connection" })).toBeVisible();
    await page.getByPlaceholder("Booking.com — Main").fill("E2E Webhook");
    await page.getByRole("button", { name: "Create connection" }).click();

    await expect(page.getByText(/Integration connection created/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Webhook secret (shown once)")).toBeVisible();
    await expect(page.getByRole("cell", { name: "E2E Webhook" })).toBeVisible();
  });

  test("webhook delivery logs generic event", async ({ page }) => {
    const created = createIntegrationConnection(E2E_ORG_ID, {
      adapterKey: "generic_webhook",
      name: "Hook for events",
    });
    if (isIntegrationError(created)) throw new Error(created.message);
    const conn = created as MockIntegrationConnection & { webhookSecret: string };

    const result = handleIntegrationWebhook(conn.id, conn.webhookSecret, {
      event: "ping",
      ok: true,
    });
    expect(result).toMatchObject({ ok: true });

    await page.goto("/settings?tab=integrations");
    await page.getByRole("cell", { name: "Hook for events" }).click();
    await expect(page.getByRole("cell", { name: "ping" })).toBeVisible({ timeout: 5000 });
    expect(getMockWebhookEvents(conn.id).length).toBeGreaterThan(0);
  });

  test("disable connection blocks webhook", async ({ page }) => {
    const created = createIntegrationConnection(E2E_ORG_ID, {
      adapterKey: "generic_webhook",
      name: "Disabled hook",
    });
    if (isIntegrationError(created)) throw new Error(created.message);
    const conn = created as MockIntegrationConnection & { webhookSecret: string };

    await page.goto("/settings?tab=integrations");
    const row = page.getByRole("row").filter({ hasText: "Disabled hook" });
    await row.getByRole("button", { name: "Disable" }).click();
    await expect(page.getByText(/Connection disabled/i)).toBeVisible({ timeout: 5000 });

    const result = handleIntegrationWebhook(conn.id, conn.webhookSecret, {
      event: "ping",
    });
    expect(result).toMatchObject({ status: 400 });
  });
});

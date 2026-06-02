import { test, expect } from "@playwright/test";
import { setupE2ePage } from "./helpers/setup";

test.describe("Branch access", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
  });

  test("branch access tab lists members and grants access", async ({ page }) => {
    await page.goto("/settings?tab=branch-access");
    await expect(page.getByRole("tab", { name: "Branch access", selected: true })).toBeVisible();
    await expect(page.getByText("front@boulevard.cafe")).toBeVisible({ timeout: 5000 });

    await page.getByLabel("Branch for access management").selectOption("branch-test-002", {
      force: true,
    });

    const frontRow = page.getByRole("row").filter({ hasText: "front@boulevard.cafe" });
    await expect(frontRow.getByText("No access")).toBeVisible();
    await frontRow.getByRole("button", { name: "Grant" }).click();
    await expect(page.getByText(/Branch access granted/i)).toBeVisible({ timeout: 5000 });
    await expect(frontRow.getByText("Granted")).toBeVisible();
  });
});

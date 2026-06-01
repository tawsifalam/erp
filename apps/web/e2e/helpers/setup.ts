import type { Page } from "@playwright/test";
import { FAKE_BRANCH_ID, FAKE_ORG_ID, mockApiRoutes, mockAuth } from "./auth";

const E2E_ACCESS_TOKEN = "mock-access-token";

/** Auth + API mocks + default tenant (call before page.goto). */
export async function setupE2ePage(page: Page) {
  await page.context().addInitScript((token) => {
    window.__ERP_E2E_ACCESS_TOKEN__ = token;
  }, E2E_ACCESS_TOKEN);
  await mockAuth(page);
  await mockApiRoutes(page);
  await page.addInitScript(
    ({ orgId, branchId, token }) => {
      window.__ERP_E2E_ACCESS_TOKEN__ = token;
      if (!localStorage.getItem("erp:tenant")) {
        localStorage.setItem(
          "erp:tenant",
          JSON.stringify({ organizationId: orgId, branchId }),
        );
      }
    },
    { orgId: FAKE_ORG_ID, branchId: FAKE_BRANCH_ID, token: E2E_ACCESS_TOKEN },
  );
}

/** Navigate and wait for the shell to finish loading tenant + first paint. */
export async function gotoApp(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => undefined);
}

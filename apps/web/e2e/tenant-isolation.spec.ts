import { test, expect } from "@playwright/test";
import { gotoApp, setupE2ePage } from "./helpers/setup";
import {
  FAKE_BRANCH_ID,
  FAKE_BRANCH_ID_2B,
  FAKE_ORG_ID,
  FAKE_ORG_ID_2,
} from "./helpers/auth";

const API_BASE = "http://localhost:3001";

test.describe("Tenant isolation (mock API)", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
    await gotoApp(page, "/dashboard");
  });

  async function apiStatus(
    page: import("@playwright/test").Page,
    path: string,
    headers: Record<string, string>,
  ) {
    return page.evaluate(
      async ({ base, path, headers }) => {
        const token = (window as unknown as { __ERP_E2E_ACCESS_TOKEN__?: string })
          .__ERP_E2E_ACCESS_TOKEN__;
        const res = await fetch(`${base}${path}`, {
          headers: { Authorization: `Bearer ${token}`, ...headers },
        });
        return { status: res.status, body: await res.json().catch(() => null) };
      },
      { base: API_BASE, path, headers },
    );
  }

  test("rejects inventory list for branch outside active organization", async ({ page }) => {
    const { status, body } = await apiStatus(
      page,
      `/api/inventory/items?branchId=${FAKE_BRANCH_ID_2B}`,
      {
        "X-Organization-Id": FAKE_ORG_ID,
        "X-Branch-Id": FAKE_BRANCH_ID,
      },
    );
    expect(status).toBe(403);
    expect(body?.message).toMatch(/Branch does not belong/);
  });

  test("rejects PMS rooms for branch outside active organization", async ({ page }) => {
    const { status } = await apiStatus(
      page,
      `/api/pms/rooms?branchId=${FAKE_BRANCH_ID_2B}`,
      {
        "X-Organization-Id": FAKE_ORG_ID,
        "X-Branch-Id": FAKE_BRANCH_ID,
      },
    );
    expect(status).toBe(403);
  });

  test("allows inventory for branch in the selected organization", async ({ page }) => {
    const { status } = await apiStatus(page, `/api/inventory/items?branchId=${FAKE_BRANCH_ID}`, {
      "X-Organization-Id": FAKE_ORG_ID,
      "X-Branch-Id": FAKE_BRANCH_ID,
    });
    expect(status).toBe(200);
  });

  test("allows inventory for branch in switched organization", async ({ page }) => {
    const { status } = await apiStatus(
      page,
      `/api/inventory/items?branchId=${FAKE_BRANCH_ID_2B}`,
      {
        "X-Organization-Id": FAKE_ORG_ID_2,
        "X-Branch-Id": FAKE_BRANCH_ID_2B,
      },
    );
    expect(status).toBe(200);
  });

  test("rejects POS orders for branch outside active organization", async ({ page }) => {
    const { status } = await apiStatus(page, `/api/pos/orders?branchId=${FAKE_BRANCH_ID_2B}`, {
      "X-Organization-Id": FAKE_ORG_ID,
      "X-Branch-Id": FAKE_BRANCH_ID,
    });
    expect(status).toBe(403);
  });

  test("rejects HR attendance for branch outside active organization", async ({ page }) => {
    const { status } = await apiStatus(page, `/api/hr/attendance?branchId=${FAKE_BRANCH_ID_2B}`, {
      "X-Organization-Id": FAKE_ORG_ID,
      "X-Branch-Id": FAKE_BRANCH_ID,
    });
    expect(status).toBe(403);
  });

  test("rejects inclusions recipes for branch outside active organization", async ({ page }) => {
    const { status } = await apiStatus(
      page,
      `/api/inclusions/recipes?branchId=${FAKE_BRANCH_ID_2B}`,
      {
        "X-Organization-Id": FAKE_ORG_ID,
        "X-Branch-Id": FAKE_BRANCH_ID,
      },
    );
    expect(status).toBe(403);
  });
});

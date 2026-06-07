import { test, expect } from "@playwright/test";
import { gotoApp, setupE2ePage } from "./helpers/setup";
import {
  FAKE_BRANCH_ID,
  FAKE_BRANCH_ID_2,
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
    options?: { method?: string; body?: unknown },
  ) {
    return page.evaluate(
      async ({ base, path, headers, method, body }) => {
        const token = (window as unknown as { __ERP_E2E_ACCESS_TOKEN__?: string })
          .__ERP_E2E_ACCESS_TOKEN__;
        const res = await fetch(`${base}${path}`, {
          method: method ?? "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: res.status, body: await res.json().catch(() => null) };
      },
      {
        base: API_BASE,
        path,
        headers,
        method: options?.method,
        body: options?.body,
      },
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

  test("rejects PMS pricing quote for room outside active organization", async ({ page }) => {
    const { status, body } = await apiStatus(
      page,
      `/api/pms/pricing/quote?roomId=rm_b_101&checkIn=2026-06-01T14:00:00Z&checkOut=2026-06-03T11:00:00Z`,
      {
        "X-Organization-Id": FAKE_ORG_ID,
        "X-Branch-Id": FAKE_BRANCH_ID,
      },
    );
    expect(status).toBe(404);
    expect(body?.message).toMatch(/Room not found/);
  });

  test("rejects journal create with foreign accountId", async ({ page }) => {
    const { status, body } = await apiStatus(
      page,
      "/api/accounting/journals",
      {
        "X-Organization-Id": FAKE_ORG_ID,
        "X-Branch-Id": FAKE_BRANCH_ID,
      },
      {
        method: "POST",
        body: {
          lines: [
            { accountId: "acc_foreign", debit: 100, credit: 0 },
            { accountId: "acc_1000", debit: 0, credit: 100 },
          ],
        },
      },
    );
    expect(status).toBe(404);
    expect(body?.message).toMatch(/Account not found/);
  });

  test("rejects FRONT_DESK without branch grant on granted branch only", async ({ page }) => {
    const { status, body } = await apiStatus(
      page,
      `/api/inventory/items?branchId=${FAKE_BRANCH_ID_2}`,
      {
        "X-Organization-Id": FAKE_ORG_ID,
        "X-Branch-Id": FAKE_BRANCH_ID,
        "X-E2E-User-Id": "usr-front-desk",
        "X-E2E-Role": "FRONT_DESK",
      },
    );
    expect(status).toBe(403);
    expect(body?.message).toMatch(/do not have access/);
  });

  test("allows FRONT_DESK with branch grant", async ({ page }) => {
    const { status } = await apiStatus(
      page,
      `/api/inventory/items?branchId=${FAKE_BRANCH_ID}`,
      {
        "X-Organization-Id": FAKE_ORG_ID,
        "X-Branch-Id": FAKE_BRANCH_ID,
        "X-E2E-User-Id": "usr-front-desk",
        "X-E2E-Role": "FRONT_DESK",
      },
    );
    expect(status).toBe(200);
  });
});

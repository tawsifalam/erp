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

  test("rejects org-level routes for unknown organization", async ({ page }) => {
    const headers = {
      "X-Organization-Id": "org-unknown-999",
      "X-Branch-Id": FAKE_BRANCH_ID,
    };
    for (const path of [
      "/api/pms/guests",
      "/api/pms/room-types",
      "/api/pms/rate-plans",
      "/api/reporting/types",
      "/api/payroll/runs",
      "/api/audit/logs",
      "/api/integrations/adapters",
      "/api/accounting/accounts",
      "/api/notifications",
      "/api/notifications/unread-count",
    ]) {
      const { status, body } = await apiStatus(page, path, headers);
      expect(status, path).toBe(403);
      expect(body?.message).toMatch(/Not a member/);
    }
  });

  test("lists only guests for the selected organization", async ({ page }) => {
    const orgA = await apiStatus(page, "/api/pms/guests", {
      "X-Organization-Id": FAKE_ORG_ID,
      "X-Branch-Id": FAKE_BRANCH_ID,
    });
    const orgB = await apiStatus(page, "/api/pms/guests", {
      "X-Organization-Id": FAKE_ORG_ID_2,
      "X-Branch-Id": FAKE_BRANCH_ID_2B,
    });
    expect(orgA.status).toBe(200);
    expect(orgB.status).toBe(200);
    const orgAIds = (orgA.body as { id: string }[]).map((g) => g.id);
    const orgBIds = (orgB.body as { id: string }[]).map((g) => g.id);
    expect(orgAIds).toContain("gst_001");
    expect(orgAIds).not.toContain("gst_b_001");
    expect(orgBIds).toContain("gst_b_001");
    expect(orgBIds).not.toContain("gst_001");
  });

  test("returns empty rate plans for organization without plans", async ({ page }) => {
    const { status, body } = await apiStatus(page, "/api/pms/rate-plans", {
      "X-Organization-Id": FAKE_ORG_ID_2,
      "X-Branch-Id": FAKE_BRANCH_ID_2B,
    });
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  test("lists different inventory items per branch in same organization", async ({ page }) => {
    const branchA1 = await apiStatus(
      page,
      `/api/inventory/items?branchId=${FAKE_BRANCH_ID}`,
      {
        "X-Organization-Id": FAKE_ORG_ID,
        "X-Branch-Id": FAKE_BRANCH_ID,
      },
    );
    const branchA2 = await apiStatus(
      page,
      `/api/inventory/items?branchId=${FAKE_BRANCH_ID_2}`,
      {
        "X-Organization-Id": FAKE_ORG_ID,
        "X-Branch-Id": FAKE_BRANCH_ID,
      },
    );
    expect(branchA1.status).toBe(200);
    expect(branchA2.status).toBe(200);
    const a1Ids = (branchA1.body as { id: string }[]).map((i) => i.id);
    const a2Ids = (branchA2.body as { id: string }[]).map((i) => i.id);
    expect(a1Ids).toContain("inv-001");
    expect(a2Ids).toContain("inv-a2-001");
    expect(a2Ids).not.toContain("inv-001");
  });

  test("lists different PMS rooms per branch in same organization", async ({ page }) => {
    const branchA1 = await apiStatus(page, `/api/pms/rooms?branchId=${FAKE_BRANCH_ID}`, {
      "X-Organization-Id": FAKE_ORG_ID,
      "X-Branch-Id": FAKE_BRANCH_ID,
    });
    const branchA2 = await apiStatus(
      page,
      `/api/pms/rooms?branchId=${FAKE_BRANCH_ID_2}`,
      {
        "X-Organization-Id": FAKE_ORG_ID,
        "X-Branch-Id": FAKE_BRANCH_ID,
      },
    );
    expect(branchA1.status).toBe(200);
    expect(branchA2.status).toBe(200);
    const a1Ids = (branchA1.body as { id: string }[]).map((r) => r.id);
    const a2Ids = (branchA2.body as { id: string }[]).map((r) => r.id);
    expect(a1Ids).toContain("rm_101");
    expect(a2Ids).toContain("rm_a2_201");
    expect(a2Ids).not.toContain("rm_101");
  });

  test("lists different POS orders per branch in same organization", async ({ page }) => {
    const branchA1 = await apiStatus(page, `/api/pos/orders?branchId=${FAKE_BRANCH_ID}`, {
      "X-Organization-Id": FAKE_ORG_ID,
      "X-Branch-Id": FAKE_BRANCH_ID,
    });
    const branchA2 = await apiStatus(
      page,
      `/api/pos/orders?branchId=${FAKE_BRANCH_ID_2}`,
      {
        "X-Organization-Id": FAKE_ORG_ID,
        "X-Branch-Id": FAKE_BRANCH_ID,
      },
    );
    expect(branchA1.status).toBe(200);
    expect(branchA2.status).toBe(200);
    const a1Ids = (branchA1.body as { id: string }[]).map((o) => o.id);
    const a2Ids = (branchA2.body as { id: string }[]).map((o) => o.id);
    expect(a1Ids).toContain("ord_001");
    expect(a2Ids).toContain("ord_a2_001");
    expect(a1Ids).not.toContain("ord_a2_001");
  });

  test("lists different inclusion recipes per branch in same organization", async ({
    page,
  }) => {
    const branchA1 = await apiStatus(
      page,
      `/api/inclusions/recipes?branchId=${FAKE_BRANCH_ID}`,
      {
        "X-Organization-Id": FAKE_ORG_ID,
        "X-Branch-Id": FAKE_BRANCH_ID,
      },
    );
    const branchA2 = await apiStatus(
      page,
      `/api/inclusions/recipes?branchId=${FAKE_BRANCH_ID_2}`,
      {
        "X-Organization-Id": FAKE_ORG_ID,
        "X-Branch-Id": FAKE_BRANCH_ID,
      },
    );
    expect(branchA1.status).toBe(200);
    expect(branchA2.status).toBe(200);
    const a1Ids = (branchA1.body as { id: string }[]).map((r) => r.id);
    const a2Ids = (branchA2.body as { id: string }[]).map((r) => r.id);
    expect(a1Ids).toContain("ir-breakfast");
    expect(a2Ids).toContain("ir-cafe-pastry");
    expect(a2Ids).not.toContain("ir-breakfast");
  });

  test("rejects guest mutation for foreign organization", async ({ page }) => {
    const { status, body } = await apiStatus(
      page,
      "/api/pms/guests/gst_b_001",
      {
        "X-Organization-Id": FAKE_ORG_ID,
        "X-Branch-Id": FAKE_BRANCH_ID,
      },
      { method: "DELETE" },
    );
    expect(status).toBe(404);
    expect(body?.message).toMatch(/Guest not found/);
  });
});

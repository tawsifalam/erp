/**
 * Real-stack checks that branch overrides cannot cross organization boundaries
 * and that branch grants restrict non-admin roles.
 */
import { test } from "@playwright/test";
import { loadSmokeAuth } from "./helpers/smoke-setup";
import { SMOKE_SEED_BRANCH_ID_2 } from "./helpers/smoke-constants";
import { useSmokeHarness } from "./helpers/smoke-local.harness";

const { expect } = useSmokeHarness();

test.describe("Smoke — tenant isolation", () => {
  test("inventory API rejects branchId outside organization", async () => {
    const auth = await loadSmokeAuth();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const foreignBranchId = "00000000-0000-0000-0000-000000000099";

    const res = await fetch(
      `${apiBase}/api/inventory/items?branchId=${foreignBranchId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "X-Organization-Id": auth.organizationId,
          "X-Branch-Id": auth.branchId,
        },
      },
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/Branch does not belong/);
  });

  test("PMS rooms rejects branchId outside organization", async () => {
    const auth = await loadSmokeAuth();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const foreignBranchId = "00000000-0000-0000-0000-000000000099";

    const res = await fetch(`${apiBase}/api/pms/rooms?branchId=${foreignBranchId}`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "X-Organization-Id": auth.organizationId,
        "X-Branch-Id": auth.branchId,
      },
    });

    expect(res.status).toBe(403);
  });

  test("reporting dashboard rejects branchId outside organization", async () => {
    const auth = await loadSmokeAuth();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const foreignBranchId = "00000000-0000-0000-0000-000000000099";

    const res = await fetch(
      `${apiBase}/api/reporting/dashboard?branchId=${foreignBranchId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "X-Organization-Id": auth.organizationId,
          "X-Branch-Id": auth.branchId,
        },
      },
    );

    expect(res.status).toBe(403);
  });

  test("PMS pricing quote rejects foreign roomId", async () => {
    const auth = await loadSmokeAuth();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const foreignRoomId = "00000000-0000-0000-0000-000000000088";

    const res = await fetch(
      `${apiBase}/api/pms/pricing/quote?roomId=${foreignRoomId}&checkIn=2026-06-01T14:00:00Z&checkOut=2026-06-03T11:00:00Z`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "X-Organization-Id": auth.organizationId,
          "X-Branch-Id": auth.branchId,
        },
      },
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/Room not found/);
  });

  test("journal create rejects foreign accountId", async () => {
    const auth = await loadSmokeAuth();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const foreignAccountId = "00000000-0000-0000-0000-000000000077";

    const roomsRes = await fetch(`${apiBase}/api/pms/rooms?branchId=${auth.branchId}`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "X-Organization-Id": auth.organizationId,
        "X-Branch-Id": auth.branchId,
      },
    });
    expect(roomsRes.status).toBe(200);

    const accountsRes = await fetch(`${apiBase}/api/accounting/accounts`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "X-Organization-Id": auth.organizationId,
        "X-Branch-Id": auth.branchId,
      },
    });
    expect(accountsRes.status).toBe(200);
    const accounts = (await accountsRes.json()) as { id: string; code: string }[];
    const localAccount = accounts.find((a) => a.code === "1000");
    expect(localAccount).toBeTruthy();

    const res = await fetch(`${apiBase}/api/accounting/journals`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
        "X-Organization-Id": auth.organizationId,
        "X-Branch-Id": auth.branchId,
      },
      body: JSON.stringify({
        lines: [
          { accountId: foreignAccountId, debit: 10, credit: 0 },
          { accountId: localAccount!.id, debit: 0, credit: 10 },
        ],
      }),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/Account not found/);
  });

  test("POS orders rejects branchId outside organization", async () => {
    const auth = await loadSmokeAuth();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const foreignBranchId = "00000000-0000-0000-0000-000000000099";

    const res = await fetch(`${apiBase}/api/pos/orders?branchId=${foreignBranchId}`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "X-Organization-Id": auth.organizationId,
        "X-Branch-Id": auth.branchId,
      },
    });

    expect(res.status).toBe(403);
  });

  test("HR attendance rejects branchId outside organization", async () => {
    const auth = await loadSmokeAuth();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const foreignBranchId = "00000000-0000-0000-0000-000000000099";

    const res = await fetch(`${apiBase}/api/hr/attendance?branchId=${foreignBranchId}`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "X-Organization-Id": auth.organizationId,
        "X-Branch-Id": auth.branchId,
      },
    });

    expect(res.status).toBe(403);
  });

  test("inclusions recipes rejects branchId outside organization", async () => {
    const auth = await loadSmokeAuth();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const foreignBranchId = "00000000-0000-0000-0000-000000000099";

    const res = await fetch(
      `${apiBase}/api/inclusions/recipes?branchId=${foreignBranchId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "X-Organization-Id": auth.organizationId,
          "X-Branch-Id": auth.branchId,
        },
      },
    );

    expect(res.status).toBe(403);
  });

  test("tenant routes reject missing X-Organization-Id header", async () => {
    const auth = await loadSmokeAuth();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

    const res = await fetch(`${apiBase}/api/inventory/items?branchId=${auth.branchId}`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "X-Branch-Id": auth.branchId,
      },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/X-Organization-Id header is required/);
  });

  test("branch members rejects foreign branchId in same request context", async () => {
    const auth = await loadSmokeAuth();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const foreignBranchId = "00000000-0000-0000-0000-000000000099";

    const res = await fetch(
      `${apiBase}/api/tenants/branches/${foreignBranchId}/members`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "X-Organization-Id": auth.organizationId,
          "X-Branch-Id": auth.branchId,
        },
      },
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/Branch not found/);
  });

  test("PMS availability rejects foreign excludeReservationId", async () => {
    const auth = await loadSmokeAuth();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const foreignReservationId = "00000000-0000-0000-0000-000000000066";

    const res = await fetch(
      `${apiBase}/api/pms/availability?branchId=${auth.branchId}&checkIn=2026-09-01T14:00:00Z&checkOut=2026-09-03T11:00:00Z&excludeReservationId=${foreignReservationId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "X-Organization-Id": auth.organizationId,
          "X-Branch-Id": auth.branchId,
        },
      },
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/Reservation not found/);
  });

  test("payroll payslip rejects unknown run id", async () => {
    const auth = await loadSmokeAuth();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const foreignRunId = "00000000-0000-0000-0000-000000000055";

    const res = await fetch(
      `${apiBase}/api/payroll/runs/${foreignRunId}/payslip`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "X-Organization-Id": auth.organizationId,
          "X-Branch-Id": auth.branchId,
        },
      },
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/Payslip not available/);
  });

  test("FRONT_DESK without branch grant cannot access another branch in same org", async () => {
    const auth = await loadSmokeAuth();
    test.skip(
      !auth.frontDeskAuth,
      "Set SMOKE_FRONT_DESK_USER_EMAIL/PASSWORD and re-run pnpm smoke:local:setup",
    );

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const fd = auth.frontDeskAuth!;
    const deniedBranchId = fd.deniedBranchId ?? SMOKE_SEED_BRANCH_ID_2;

    const res = await fetch(
      `${apiBase}/api/inventory/items?branchId=${deniedBranchId}`,
      {
        headers: {
          Authorization: `Bearer ${fd.accessToken}`,
          "X-Organization-Id": auth.organizationId,
          "X-Branch-Id": fd.grantedBranchId,
        },
      },
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toMatch(/do not have access/);
  });
});

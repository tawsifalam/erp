/**
 * Real-stack checks that branch overrides cannot cross organization boundaries.
 */
import { test } from "@playwright/test";
import { loadSmokeAuth } from "./helpers/smoke-setup";
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
});

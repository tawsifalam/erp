import { beforeEach, describe, expect, it } from "vitest";
import {
  MOCK_BRANCH_A1,
  MOCK_BRANCH_A2,
  MOCK_BRANCH_B1,
  MOCK_ORG_A,
  MOCK_ORG_B,
  assertMockAccountsInOrg,
  assertMockBranchGrant,
  assertMockBranchInOrg,
  assertMockOrganizationAccess,
  assertMockRoomInOrg,
  resolveMockBranchId,
} from "./tenant-scope-mock";
import { resetBranchAccessState } from "./branch-access-state";
import { getPmsGuests, getPmsRoomTypes, resetPmsState } from "./pms-state";
import { getRatePlans, resetRatesState } from "./rates-state";
import { resetAccountingState } from "./accounting-state";

describe("tenant-scope-mock", () => {
  beforeEach(() => {
    resetBranchAccessState();
    resetPmsState();
    resetRatesState();
    resetAccountingState();
  });

  it("rejects unknown organization", () => {
    const err = assertMockOrganizationAccess("org-unknown");
    expect(err?.status).toBe(403);
    expect(err?.message).toMatch(/Not a member/);
  });

  it("allows known mock organizations", () => {
    expect(assertMockOrganizationAccess(MOCK_ORG_A)).toBeNull();
    expect(assertMockOrganizationAccess(MOCK_ORG_B)).toBeNull();
  });

  it("filters guests by organization", () => {
    const orgAGuests = getPmsGuests(MOCK_ORG_A);
    const orgBGuests = getPmsGuests(MOCK_ORG_B);
    expect(orgAGuests.every((g) => g.organizationId === MOCK_ORG_A)).toBe(true);
    expect(orgBGuests.every((g) => g.organizationId === MOCK_ORG_B)).toBe(true);
    expect(orgAGuests.some((g) => g.id === "gst_b_001")).toBe(false);
    expect(orgBGuests.some((g) => g.id === "gst_b_001")).toBe(true);
  });

  it("filters room types and rate plans by organization", () => {
    expect(getPmsRoomTypes(MOCK_ORG_B).some((rt) => rt.id === "rt_b_001")).toBe(true);
    expect(getPmsRoomTypes(MOCK_ORG_A).some((rt) => rt.id === "rt_b_001")).toBe(false);
    expect(getRatePlans(MOCK_ORG_B)).toHaveLength(0);
    expect(getRatePlans(MOCK_ORG_A).length).toBeGreaterThan(0);
  });

  it("rejects branch from another organization", () => {
    const err = assertMockBranchInOrg(MOCK_ORG_A, MOCK_BRANCH_B1);
    expect(err?.status).toBe(403);
    expect(err?.message).toMatch(/Branch does not belong/);
  });

  it("allows branch within organization", () => {
    expect(assertMockBranchInOrg(MOCK_ORG_A, MOCK_BRANCH_A1)).toBeNull();
  });

  it("resolves query override after validation", () => {
    const resolved = resolveMockBranchId(MOCK_ORG_A, MOCK_BRANCH_A1, MOCK_BRANCH_A2);
    expect(resolved.branchId).toBe(MOCK_BRANCH_A2);
    expect(resolved.error).toBeUndefined();
  });

  it("rejects invalid query override", () => {
    const resolved = resolveMockBranchId(MOCK_ORG_A, MOCK_BRANCH_A1, MOCK_BRANCH_B1);
    expect(resolved.error?.status).toBe(403);
  });

  it("allows second organization branch", () => {
    const resolved = resolveMockBranchId(MOCK_ORG_B, MOCK_BRANCH_B1, null);
    expect(resolved.branchId).toBe(MOCK_BRANCH_B1);
  });

  it("rejects FRONT_DESK without branch grant", () => {
    const err = assertMockBranchGrant(MOCK_ORG_A, MOCK_BRANCH_A2, {
      userId: "usr-front-desk",
      role: "FRONT_DESK",
    });
    expect(err?.status).toBe(403);
    expect(err?.message).toMatch(/do not have access/);
  });

  it("allows FRONT_DESK with branch grant", () => {
    const err = assertMockBranchGrant(MOCK_ORG_A, MOCK_BRANCH_A1, {
      userId: "usr-front-desk",
      role: "FRONT_DESK",
    });
    expect(err).toBeNull();
  });

  it("rejects room from another organization", () => {
    const err = assertMockRoomInOrg(MOCK_ORG_A, "rm_b_101");
    expect(err?.status).toBe(404);
  });

  it("allows room in same organization", () => {
    expect(assertMockRoomInOrg(MOCK_ORG_A, "rm_101")).toBeNull();
  });

  it("rejects foreign account on journal lines", () => {
    const err = assertMockAccountsInOrg(MOCK_ORG_A, ["acc_1000", "acc_foreign"]);
    expect(err?.status).toBe(404);
  });

  it("allows accounts in organization", () => {
    expect(assertMockAccountsInOrg(MOCK_ORG_A, ["acc_1000", "acc_4000"])).toBeNull();
  });
});

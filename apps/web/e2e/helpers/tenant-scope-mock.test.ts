import { describe, expect, it } from "vitest";
import {
  MOCK_BRANCH_A1,
  MOCK_BRANCH_A2,
  MOCK_BRANCH_B1,
  MOCK_ORG_A,
  MOCK_ORG_B,
  assertMockBranchInOrg,
  resolveMockBranchId,
} from "./tenant-scope-mock";

describe("tenant-scope-mock", () => {
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
});

/** E2E org/branch ids — keep in sync with auth.ts FAKE_* constants. */
export const MOCK_ORG_A = "org-test-001";
export const MOCK_ORG_B = "org-test-002";
export const MOCK_BRANCH_A1 = "branch-test-001";
export const MOCK_BRANCH_A2 = "branch-test-002";
export const MOCK_BRANCH_B1 = "branch-test-003";

/** Branch ids allowed per mock organization (mirrors tenant-state memberships). */
const ORG_BRANCH_IDS: Record<string, string[]> = {
  [MOCK_ORG_A]: [MOCK_BRANCH_A1, MOCK_BRANCH_A2],
  [MOCK_ORG_B]: [MOCK_BRANCH_B1],
};

export type MockScopeError = { status: number; message: string };

export function assertMockBranchInOrg(
  organizationId: string,
  branchId: string,
): MockScopeError | null {
  const allowed = ORG_BRANCH_IDS[organizationId];
  if (!allowed) {
    return { status: 403, message: "Not a member of this organization" };
  }
  if (!allowed.includes(branchId)) {
    return { status: 403, message: "Branch does not belong to this organization" };
  }
  return null;
}

export function resolveMockBranchId(
  organizationId: string,
  headerBranchId: string | undefined,
  queryBranchId: string | null,
  options?: { required?: boolean },
): { branchId?: string; error?: MockScopeError } {
  const required = options?.required ?? true;
  const branchId = queryBranchId ?? headerBranchId ?? undefined;
  if (!branchId) {
    if (required) return { error: { status: 400, message: "branchId is required" } };
    return {};
  }
  const scopeError = assertMockBranchInOrg(organizationId, branchId);
  if (scopeError) return { error: scopeError };
  return { branchId };
}

export function branchIdFromRequestUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get("branchId");
  } catch {
    return null;
  }
}

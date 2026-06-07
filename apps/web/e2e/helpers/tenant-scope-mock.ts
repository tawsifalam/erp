import { getAccessibleBranchesForUser } from "./branch-access-state";
import { getAccountingAccounts } from "./accounting-state";
import { getPmsRooms } from "./pms-state";

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

export type MockActor = { userId: string; role: string };

const DEFAULT_ACTOR: MockActor = { userId: "usr-e2e-admin", role: "ADMIN" };

function hasImplicitBranchAccess(role: string): boolean {
  return role === "ADMIN" || role === "OWNER";
}

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

export function assertMockBranchGrant(
  organizationId: string,
  branchId: string,
  actor: MockActor,
): MockScopeError | null {
  if (hasImplicitBranchAccess(actor.role)) return null;

  const allowed = getAccessibleBranchesForUser(actor.userId, actor.role);
  if (!allowed.some((b) => b.id === branchId)) {
    return { status: 403, message: "You do not have access to this branch" };
  }

  const orgError = assertMockBranchInOrg(organizationId, branchId);
  if (orgError) return orgError;

  return null;
}

export function resolveMockBranchId(
  organizationId: string,
  headerBranchId: string | undefined,
  queryBranchId: string | null,
  options?: { required?: boolean; actor?: MockActor },
): { branchId?: string; error?: MockScopeError } {
  const required = options?.required ?? true;
  const actor = options?.actor ?? DEFAULT_ACTOR;
  const branchId = queryBranchId ?? headerBranchId ?? undefined;
  if (!branchId) {
    if (required) return { error: { status: 400, message: "branchId is required" } };
    return {};
  }
  const scopeError = assertMockBranchInOrg(organizationId, branchId);
  if (scopeError) return { error: scopeError };

  const grantError = assertMockBranchGrant(organizationId, branchId, actor);
  if (grantError) return { error: grantError };

  return { branchId };
}

export function branchIdFromRequestUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get("branchId");
  } catch {
    return null;
  }
}

export function actorFromRequestHeaders(
  headers: Record<string, string>,
): MockActor {
  return {
    userId: headers["x-e2e-user-id"] ?? DEFAULT_ACTOR.userId,
    role: headers["x-e2e-role"] ?? DEFAULT_ACTOR.role,
  };
}

export function assertMockRoomInOrg(
  organizationId: string,
  roomId: string,
): MockScopeError | null {
  const room = getPmsRooms().find((r) => r.id === roomId);
  if (!room || room.organizationId !== organizationId) {
    return { status: 404, message: "Room not found" };
  }
  return null;
}

export function assertMockAccountsInOrg(
  organizationId: string,
  accountIds: string[],
): MockScopeError | null {
  const accounts = getAccountingAccounts(organizationId);
  const allowed = new Set(accounts.map((a) => a.id));
  const uniqueIds = [...new Set(accountIds)];
  if (uniqueIds.some((id) => !allowed.has(id))) {
    return { status: 404, message: "Account not found" };
  }
  return null;
}

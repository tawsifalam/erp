/** Branch access grants for Playwright API mocks. */

import { E2E_ORG_ID } from "./audit-state";
import { getOrganizationById, getTenantBranches } from "./tenant-state";

export type MockBranchMember = {
  userId: string;
  role: string;
  implicitAccess: boolean;
  hasBranchAccess: boolean;
  user: { id: string; email: string; name: string | null };
};

const ORG_MEMBERS = [
  {
    userId: "usr-e2e-admin",
    role: "ADMIN",
    user: { id: "usr-e2e-admin", email: "admin@boulevard.cafe", name: "Admin" },
  },
  {
    userId: "usr-front-desk",
    role: "FRONT_DESK",
    user: { id: "usr-front-desk", email: "front@boulevard.cafe", name: "Front Desk" },
  },
];

/** branchId -> userIds with ACTIVE grant */
let grants = new Map<string, Set<string>>();

export function resetBranchAccessState() {
  grants = new Map();
  // Front desk only has Main Branch by default in E2E
  grants.set("branch-test-001", new Set(["usr-front-desk"]));
}

function branchExistsInOrg(branchId: string, orgId?: string): boolean {
  const branches = orgId
    ? (getOrganizationById(orgId)?.branches ?? [])
    : getTenantBranches();
  return branches.some((b) => b.id === branchId);
}

export function listBranchMembers(branchId: string, orgId?: string): MockBranchMember[] | { status: number; message: string } {
  if (!branchExistsInOrg(branchId, orgId)) {
    return { status: 404, message: "Branch not found" };
  }
  const branchGrants = grants.get(branchId) ?? new Set<string>();
  return ORG_MEMBERS.map((m) => ({
    userId: m.userId,
    role: m.role,
    user: m.user,
    implicitAccess: m.role === "ADMIN" || m.role === "OWNER",
    hasBranchAccess:
      m.role === "ADMIN" || m.role === "OWNER" || branchGrants.has(m.userId),
  }));
}

export function grantBranchAccess(branchId: string, userId: string) {
  const member = ORG_MEMBERS.find((m) => m.userId === userId);
  if (!member) return { status: 404, message: "Member not found" };
  if (member.role === "ADMIN" || member.role === "OWNER") {
    return { status: 400, message: "Owners and admins already have access to all branches" };
  }
  const set = grants.get(branchId) ?? new Set<string>();
  set.add(userId);
  grants.set(branchId, set);
  return { id: `ubr_${branchId}_${userId}`, userId, branchId, status: "ACTIVE" };
}

export function revokeBranchAccess(branchId: string, userId: string) {
  const set = grants.get(branchId);
  if (!set?.has(userId)) return { status: 404, message: "Branch access grant not found" };
  set.delete(userId);
  return { ok: true };
}

export function getAccessibleBranchesForUser(userId: string, role: string) {
  const branches = getTenantBranches();
  if (role === "ADMIN" || role === "OWNER") return branches;

  const allowed = new Set<string>();
  for (const [branchId, users] of grants.entries()) {
    if (users.has(userId)) allowed.add(branchId);
  }
  return branches.filter((b) => allowed.has(b.id));
}

export function handleBranchAccessMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
  orgId?: string,
): unknown {
  const membersMatch = url.match(/\/tenants\/branches\/([^/]+)\/members(?:\/([^/?]+))?/);
  if (!membersMatch) return null;

  const branchId = membersMatch[1]!;
  const targetUserId = membersMatch[2];

  if (method === "GET" && !targetUserId) {
    return listBranchMembers(branchId, orgId);
  }

  if (method === "POST" && !targetUserId) {
    const userId = String(body?.userId ?? "");
    const result = grantBranchAccess(branchId, userId);
    if ("status" in result && result.status >= 400) return result;
    return result;
  }

  if (method === "DELETE" && targetUserId) {
    const result = revokeBranchAccess(branchId, targetUserId);
    if ("status" in result && result.status >= 400) return result;
    return result;
  }

  return null;
}

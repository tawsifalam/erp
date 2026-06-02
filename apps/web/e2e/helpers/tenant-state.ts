import { E2E_ORG_ID, recordAudit } from "./audit-state";
import {
  handleBranchAccessMutation,
  resetBranchAccessState,
} from "./branch-access-state";

type MockBranch = {
  id: string;
  name: string;
  timezone: string;
};

type MockOrgCurrent = {
  id: string;
  name: string;
  propelAuthOrgId: string;
  joinCode: string;
  branches: MockBranch[];
};

const INITIAL_BRANCHES: MockBranch[] = [
  { id: "branch-test-001", name: "Main Branch", timezone: "Asia/Dhaka" },
  { id: "branch-test-002", name: "Annex Branch", timezone: "Asia/Dhaka" },
];

let orgName = "Boulevard Café";
let branches = structuredClone(INITIAL_BRANCHES) as MockBranch[];

export function resetTenantState() {
  orgName = "Boulevard Café";
  branches = structuredClone(INITIAL_BRANCHES) as MockBranch[];
  resetBranchAccessState();
}

export function getTenantBranches() {
  return branches.map((b) => ({ ...b }));
}

export function getOrgName() {
  return orgName;
}

export function getCurrentOrganization(): MockOrgCurrent {
  return {
    id: "org-test-001",
    name: orgName,
    propelAuthOrgId: "demo-org-propelauth",
    joinCode: "ov_testcode",
    branches: getTenantBranches(),
  };
}

export function handleTenantMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  const branchAccess = handleBranchAccessMutation(method, url, body);
  if (branchAccess !== null) return branchAccess;

  if (url.includes("/tenants/organizations/current")) {
    if (method === "GET") return getCurrentOrganization();
    if (method === "PATCH" && body?.name) {
      orgName = String(body.name);
      recordAudit({
        action: "UPDATE",
        entityType: "organization",
        entityId: E2E_ORG_ID,
        metadata: { name: orgName },
      });
      return getCurrentOrganization();
    }
  }

  if (url.match(/\/tenants\/branches\/[^/?]+/) && method === "PATCH") {
    const idMatch = url.match(/\/branches\/([^/?]+)/);
    const id = idMatch?.[1];
    const branch = branches.find((b) => b.id === id);
    if (!branch) return { status: 404, message: "Branch not found" };
    if (body?.name) branch.name = String(body.name);
    if (body?.timezone) branch.timezone = String(body.timezone);
    recordAudit({
      action: "UPDATE",
      entityType: "branch",
      entityId: id,
      metadata: { name: branch.name },
    });
    return { ...branch };
  }

  if (url.match(/\/tenants\/branches\/[^/?]+/) && method === "DELETE") {
    const idMatch = url.match(/\/branches\/([^/?]+)/);
    const id = idMatch?.[1];
    const branch = branches.find((b) => b.id === id);
    if (!branch) return { status: 404, message: "Branch not found" };
    if (branches.length <= 1) {
      return { status: 400, message: "Cannot delete the last branch in the organization" };
    }
    branches = branches.filter((b) => b.id !== id);
    recordAudit({
      action: "DELETE",
      entityType: "branch",
      entityId: id,
      metadata: { name: branch.name },
    });
    return { deleted: true, id };
  }

  if (url.includes("/tenants/branches")) {
    if (method === "GET") return getTenantBranches();
    if (method === "POST") {
      const branch: MockBranch = {
        id: `branch_${branches.length + 1}`,
        name: String(body?.name ?? "New Branch"),
        timezone: String(body?.timezone ?? "Asia/Dhaka"),
      };
      branches.push(branch);
      recordAudit({
        action: "CREATE",
        entityType: "branch",
        entityId: branch.id,
        metadata: { name: branch.name },
      });
      return branch;
    }
  }

  if (url.includes("/tenants/organizations") && method === "POST") {
    return {
      organization: {
        id: "org-new-001",
        name: String(body?.name ?? "New Org"),
        branches: [{ id: "branch-new-001", name: "Main Branch", timezone: String(body?.timezone ?? "Asia/Dhaka") }],
      },
    };
  }

  return {};
}

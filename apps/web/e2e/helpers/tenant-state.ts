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
  joinCode: string;
  branches: MockBranch[];
};

const MOCK_ORG_B_ID = "org-test-002";
const MOCK_BRANCH_B1_ID = "branch-test-003";

const INITIAL_BRANCHES: MockBranch[] = [
  { id: "branch-test-001", name: "Main Branch", timezone: "Asia/Dhaka" },
  { id: "branch-test-002", name: "Annex Branch", timezone: "Asia/Dhaka" },
];

const ORG_B: MockOrgCurrent = {
  id: MOCK_ORG_B_ID,
  name: "Harbor Hotel Group",
  joinCode: "ov_harbor",
  branches: [{ id: MOCK_BRANCH_B1_ID, name: "Harbor Downtown", timezone: "Asia/Dhaka" }],
};

let orgName = "Boulevard Café";
let branches = structuredClone(INITIAL_BRANCHES) as MockBranch[];
let createdOrganizations: MockOrgCurrent[] = [];

export function resetTenantState() {
  orgName = "Boulevard Café";
  branches = structuredClone(INITIAL_BRANCHES) as MockBranch[];
  createdOrganizations = [];
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
    joinCode: "ov_testcode",
    branches: getTenantBranches(),
  };
}

export function getOrganizationById(orgId: string): MockOrgCurrent | null {
  if (orgId === "org-test-001") return getCurrentOrganization();
  if (orgId === MOCK_ORG_B_ID) return ORG_B;
  return createdOrganizations.find((org) => org.id === orgId) ?? null;
}

function branchBelongsToOrg(branchId: string, orgId?: string): boolean {
  if (!orgId) return branches.some((b) => b.id === branchId);
  const org = getOrganizationById(orgId);
  if (!org) return false;
  return org.branches.some((b) => b.id === branchId);
}

function findMutableBranch(branchId: string, orgId?: string): MockBranch | undefined {
  if (!orgId || orgId === "org-test-001") {
    return branches.find((b) => b.id === branchId);
  }
  const org = getOrganizationById(orgId);
  return org?.branches.find((b) => b.id === branchId);
}

export function getCreatedOrganizationMemberships() {
  return createdOrganizations.map((org) => ({
    organizationId: org.id,
    role: "OWNER",
    organization: {
      id: org.id,
      name: org.name,
      branches: org.branches.map((b) => ({ id: b.id, name: b.name })),
    },
  }));
}

export function listOrgMembers(organizationId: string) {
  if (organizationId === "org-test-001") {
    return [
      {
        userId: "usr-e2e-admin",
        role: "ADMIN",
        isFounder: true,
        user: { id: "usr-e2e-admin", email: "admin@test.com", name: "Admin User" },
      },
      {
        userId: "usr-front-desk",
        role: "FRONT_DESK",
        isFounder: false,
        user: { id: "usr-front-desk", email: "desk@test.com", name: "Front Desk" },
      },
    ];
  }
  if (organizationId === "org-test-002") {
    return [
      {
        userId: "usr-org-b-owner",
        role: "OWNER",
        isFounder: true,
        user: { id: "usr-org-b-owner", email: "owner@harbor.example", name: "Harbor Owner" },
      },
    ];
  }
  return [];
}

export function handleTenantMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
  activeOrgId?: string,
): unknown {
  const branchAccess = handleBranchAccessMutation(method, url, body, activeOrgId);
  if (branchAccess !== null) return branchAccess;

  if (url.includes("/tenants/organizations/current")) {
    const org = activeOrgId ? getOrganizationById(activeOrgId) : getCurrentOrganization();
    if (method === "GET") {
      if (!org) return { status: 403, message: "Not a member of this organization" };
      return org;
    }
    if (method === "PATCH" && body?.name) {
      if (!org) return { status: 403, message: "Not a member of this organization" };
      if (org.id === "org-test-001") {
        orgName = String(body.name);
        recordAudit({
          action: "UPDATE",
          entityType: "organization",
          entityId: E2E_ORG_ID,
          metadata: { name: orgName },
        });
        return getCurrentOrganization();
      }
      org.name = String(body.name);
      return org;
    }
  }

  if (url.match(/\/tenants\/branches\/[^/?]+/) && method === "PATCH") {
    const idMatch = url.match(/\/branches\/([^/?]+)/);
    const id = idMatch?.[1];
    if (activeOrgId && !getOrganizationById(activeOrgId)) {
      return { status: 403, message: "Not a member of this organization" };
    }
    const branch = findMutableBranch(id!, activeOrgId);
    if (!branch || !branchBelongsToOrg(id!, activeOrgId)) {
      return { status: 404, message: "Branch not found" };
    }
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
    if (activeOrgId && !getOrganizationById(activeOrgId)) {
      return { status: 403, message: "Not a member of this organization" };
    }
    const branch = findMutableBranch(id!, activeOrgId);
    if (!branch || !branchBelongsToOrg(id!, activeOrgId)) {
      return { status: 404, message: "Branch not found" };
    }
    const orgBranches =
      !activeOrgId || activeOrgId === "org-test-001"
        ? branches
        : (getOrganizationById(activeOrgId)?.branches ?? []);
    if (orgBranches.length <= 1) {
      return { status: 400, message: "Cannot delete the last branch in the organization" };
    }
    if (!activeOrgId || activeOrgId === "org-test-001") {
      branches = branches.filter((b) => b.id !== id);
    } else {
      const org = getOrganizationById(activeOrgId);
      if (org) org.branches = org.branches.filter((b) => b.id !== id);
    }
    recordAudit({
      action: "DELETE",
      entityType: "branch",
      entityId: id,
      metadata: { name: branch.name },
    });
    return { deleted: true, id };
  }

  if (url.includes("/tenants/branches")) {
    if (method === "GET") {
      const org = activeOrgId ? getOrganizationById(activeOrgId) : getCurrentOrganization();
      if (!org) return { status: 403, message: "Not a member of this organization" };
      return org.branches;
    }
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
    const created: MockOrgCurrent = {
      id: `org-new-${createdOrganizations.length + 1}`,
      name: String(body?.name ?? "New Org"),
      joinCode: `ov_new_${createdOrganizations.length + 1}`,
      branches: [
        {
          id: `branch-new-${createdOrganizations.length + 1}`,
          name: "Main Branch",
          timezone: String(body?.timezone ?? "Asia/Dhaka"),
        },
      ],
    };
    createdOrganizations.push(created);
    return {
      organization: {
        id: created.id,
        name: created.name,
        branches: created.branches,
      },
    };
  }

  return {};
}

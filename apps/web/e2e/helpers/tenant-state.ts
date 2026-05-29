type MockBranch = {
  id: string;
  name: string;
  timezone: string;
};

type MockOrgCurrent = {
  id: string;
  name: string;
  propelAuthOrgId: string;
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
}

export function getTenantBranches() {
  return branches.map((b) => ({ ...b }));
}

export function getCurrentOrganization(): MockOrgCurrent {
  return {
    id: "org-test-001",
    name: orgName,
    propelAuthOrgId: "demo-org-propelauth",
    branches: getTenantBranches(),
  };
}

export function handleTenantMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  if (url.includes("/tenants/organizations/current")) {
    if (method === "GET") return getCurrentOrganization();
    if (method === "PATCH" && body?.name) {
      orgName = String(body.name);
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
    return { ...branch };
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

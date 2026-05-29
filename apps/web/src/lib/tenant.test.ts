import { describe, expect, it } from "vitest";
import {
  findMembership,
  getBranchesForOrg,
  parseStoredTenant,
  pickDefaultBranch,
  pickInitialTenant,
  resolveBranchChange,
  resolveOrganizationChange,
  serializeStoredTenant,
  type OrgMembership,
} from "./tenant";

const memberships: OrgMembership[] = [
  {
    organizationId: "org_a",
    role: "ADMIN",
    organization: {
      id: "org_a",
      name: "Hotel Alpha",
      branches: [
        { id: "br_a1", name: "Alpha Main" },
        { id: "br_a2", name: "Alpha Annex" },
      ],
    },
  },
  {
    organizationId: "org_b",
    role: "ADMIN",
    organization: {
      id: "org_b",
      name: "Café Beta",
      branches: [{ id: "br_b1", name: "Beta Downtown" }],
    },
  },
];

describe("tenant selection logic", () => {
  it("findMembership returns org by id", () => {
    expect(findMembership(memberships, "org_b")?.organization.name).toBe("Café Beta");
    expect(findMembership(memberships, "missing")).toBeUndefined();
  });

  it("getBranchesForOrg lists branches for org", () => {
    expect(getBranchesForOrg(memberships, "org_a")).toHaveLength(2);
    expect(getBranchesForOrg(memberships, "org_a")[0]?.id).toBe("br_a1");
  });

  it("pickDefaultBranch returns first branch", () => {
    expect(pickDefaultBranch(memberships, "org_a")).toBe("br_a1");
    expect(pickDefaultBranch(memberships, "org_b")).toBe("br_b1");
  });

  it("resolveOrganizationChange resets branch to first in new org", () => {
    const next = resolveOrganizationChange(memberships, "org_b");
    expect(next.organizationId).toBe("org_b");
    expect(next.branchId).toBe("br_b1");
  });

  it("pickInitialTenant uses stored selection when valid", () => {
    const initial = pickInitialTenant(memberships, {
      organizationId: "org_a",
      branchId: "br_a2",
    });
    expect(initial.organizationId).toBe("org_a");
    expect(initial.branchId).toBe("br_a2");
  });

  it("pickInitialTenant falls back when stored org is unknown", () => {
    const initial = pickInitialTenant(memberships, {
      organizationId: "org_z",
      branchId: "br_z",
    });
    expect(initial.organizationId).toBe("org_a");
    expect(initial.branchId).toBe("br_a1");
  });

  it("pickInitialTenant fixes invalid stored branch", () => {
    const initial = pickInitialTenant(memberships, {
      organizationId: "org_a",
      branchId: "br_invalid",
    });
    expect(initial.branchId).toBe("br_a1");
  });

  it("resolveBranchChange rejects branch from another org", () => {
    const resolved = resolveBranchChange(memberships, "org_a", "br_b1");
    expect(resolved).toBe("br_a1");
  });

  it("resolveBranchChange accepts valid branch", () => {
    const resolved = resolveBranchChange(memberships, "org_a", "br_a2");
    expect(resolved).toBe("br_a2");
  });

  it("parseStoredTenant and serialize round-trip", () => {
    const raw = serializeStoredTenant({ organizationId: "org_a", branchId: "br_a2" });
    expect(parseStoredTenant(raw)).toEqual({
      organizationId: "org_a",
      branchId: "br_a2",
    });
    expect(parseStoredTenant("not-json")).toBeNull();
  });
});

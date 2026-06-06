export type Branch = { id: string; name: string };
export type Organization = { id: string; name: string; branches: Branch[] };

export type OrgMembership = {
  organizationId: string;
  role: string;
  organization: Organization;
};

export const TENANT_STORAGE_KEY = "erp:tenant";

export type StoredTenant = {
  organizationId: string;
  branchId: string | null;
};

export function findMembership(
  memberships: OrgMembership[],
  organizationId: string,
): OrgMembership | undefined {
  return memberships.find((m) => m.organizationId === organizationId);
}

export function getBranchesForOrg(
  memberships: OrgMembership[],
  organizationId: string,
): Branch[] {
  return findMembership(memberships, organizationId)?.organization.branches ?? [];
}

export function pickDefaultBranch(
  memberships: OrgMembership[],
  organizationId: string,
): string | null {
  const branches = getBranchesForOrg(memberships, organizationId);
  return branches[0]?.id ?? null;
}

/** When the user picks a different organization, reset branch to that org's first branch. */
export function resolveOrganizationChange(
  memberships: OrgMembership[],
  organizationId: string,
): { organizationId: string; branchId: string | null } {
  return {
    organizationId,
    branchId: pickDefaultBranch(memberships, organizationId),
  };
}

/** Keep a branch id only when it exists in the loaded branch list (e.g. after org switch). */
export function pickManagedBranchId(
  current: string,
  branches: { id: string }[],
): string {
  if (current && branches.some((b) => b.id === current)) return current;
  return branches[0]?.id ?? "";
}

/** Apply an explicit org (and optional branch) against a fresh membership list. */
export function resolveTenantSelection(
  memberships: OrgMembership[],
  organizationId: string,
  branchId?: string | null,
): { organizationId: string; branchId: string | null } {
  const membership = findMembership(memberships, organizationId);
  if (!membership) {
    const fallback = pickInitialTenant(memberships, null);
    return {
      organizationId: fallback.organizationId ?? organizationId,
      branchId: fallback.branchId,
    };
  }

  const branches = membership.organization.branches;
  const validBranch =
    branchId != null && branches.some((b) => b.id === branchId)
      ? branchId
      : pickDefaultBranch(memberships, organizationId);

  return { organizationId, branchId: validBranch };
}

/** Restore from localStorage when valid; otherwise default to first membership. */
export function pickInitialTenant(
  memberships: OrgMembership[],
  stored: StoredTenant | null,
): { organizationId: string | null; branchId: string | null } {
  if (memberships.length === 0) {
    return { organizationId: null, branchId: null };
  }

  if (stored) {
    const membership = findMembership(memberships, stored.organizationId);
    if (membership) {
      const branches = membership.organization.branches;
      const branchValid =
        stored.branchId != null && branches.some((b) => b.id === stored.branchId);
      return {
        organizationId: stored.organizationId,
        branchId: branchValid
          ? stored.branchId
          : pickDefaultBranch(memberships, stored.organizationId),
      };
    }
  }

  const first = memberships[0]!;
  return {
    organizationId: first.organizationId,
    branchId: pickDefaultBranch(memberships, first.organizationId),
  };
}

export function parseStoredTenant(raw: string | null): StoredTenant | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredTenant;
    if (typeof parsed.organizationId === "string" && parsed.organizationId.length > 0) {
      return {
        organizationId: parsed.organizationId,
        branchId:
          typeof parsed.branchId === "string" ? parsed.branchId : null,
      };
    }
  } catch {
    /* invalid JSON */
  }
  return null;
}

export function serializeStoredTenant(tenant: StoredTenant): string {
  return JSON.stringify(tenant);
}

/** Validate branch belongs to the selected organization before applying. */
export function resolveBranchChange(
  memberships: OrgMembership[],
  organizationId: string | null,
  branchId: string,
): string | null {
  if (!organizationId) return null;
  const branches = getBranchesForOrg(memberships, organizationId);
  return branches.some((b) => b.id === branchId) ? branchId : pickDefaultBranch(memberships, organizationId);
}

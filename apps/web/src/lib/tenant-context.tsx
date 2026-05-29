"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { apiFetch } from "./api-client";
import {
  type OrgMembership,
  pickInitialTenant,
  resolveBranchChange,
  resolveOrganizationChange,
} from "./tenant";
import { readStoredTenant, writeStoredTenant } from "./tenant-storage";

type TenantState = {
  organizationId: string | null;
  branchId: string | null;
  setOrganizationId: (id: string) => void;
  setBranchId: (id: string) => void;
  memberships: OrgMembership[];
  loading: boolean;
};

const TenantContext = createContext<TenantState | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [organizationId, setOrganizationIdState] = useState<string | null>(null);
  const [branchId, setBranchIdState] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<
      {
        organizationId: string;
        role: string;
        organization: { id: string; name: string; branches: { id: string; name: string }[] };
      }[]
    >("/tenants/organizations")
      .then((data) => {
        const mapped: OrgMembership[] = data.map((m) => ({
          organizationId: m.organizationId,
          role: m.role,
          organization: m.organization,
        }));
        setMemberships(mapped);
        const initial = pickInitialTenant(mapped, readStoredTenant());
        setOrganizationIdState(initial.organizationId);
        setBranchIdState(initial.branchId);
        if (initial.organizationId) {
          writeStoredTenant({
            organizationId: initial.organizationId,
            branchId: initial.branchId,
          });
        }
      })
      .catch(() => setMemberships([]))
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((orgId: string | null, brId: string | null) => {
    if (orgId) {
      writeStoredTenant({ organizationId: orgId, branchId: brId });
    }
  }, []);

  const setOrganizationId = useCallback(
    (id: string) => {
      const next = resolveOrganizationChange(memberships, id);
      setOrganizationIdState(next.organizationId);
      setBranchIdState(next.branchId);
      persist(next.organizationId, next.branchId);
    },
    [memberships, persist],
  );

  const setBranchId = useCallback(
    (id: string) => {
      const resolved = resolveBranchChange(memberships, organizationId, id);
      setBranchIdState(resolved);
      if (organizationId) {
        persist(organizationId, resolved);
      }
    },
    [memberships, organizationId, persist],
  );

  return (
    <TenantContext.Provider
      value={{
        organizationId,
        branchId,
        setOrganizationId,
        setBranchId,
        memberships,
        loading,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}

export function useTenantHeaders() {
  const { organizationId, branchId } = useTenant();
  return {
    organizationId: organizationId!,
    branchId: branchId ?? undefined,
  };
}

export type { OrgMembership };

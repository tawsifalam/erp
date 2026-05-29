"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { apiFetch } from "./api-client";

type OrgMembership = {
  organizationId: string;
  role: string;
  organization: { id: string; name: string; branches: { id: string; name: string }[] };
};

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
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
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
        if (mapped[0]) {
          setOrganizationId(mapped[0].organizationId);
          if (mapped[0].organization.branches[0]) {
            setBranchId(mapped[0].organization.branches[0].id);
          }
        }
      })
      .catch(() => setMemberships([]))
      .finally(() => setLoading(false));
  }, []);

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

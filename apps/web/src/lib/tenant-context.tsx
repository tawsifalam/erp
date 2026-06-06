"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@propelauth/nextjs/client";
import { apiFetch } from "./api-client";
import {
  type OrgMembership,
  findMembership,
  pickInitialTenant,
  resolveBranchChange,
  resolveOrganizationChange,
  resolveTenantSelection,
} from "./tenant";
import { readStoredTenant, writeStoredTenant } from "./tenant-storage";

type TenantState = {
  organizationId: string | null;
  branchId: string | null;
  role: string | null;
  setOrganizationId: (id: string) => void;
  setBranchId: (id: string) => void;
  memberships: OrgMembership[];
  loading: boolean;
  refreshMemberships: (options?: {
    organizationId?: string;
    branchId?: string | null;
  }) => Promise<OrgMembership[]>;
};

const TenantContext = createContext<TenantState | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loading: authLoading } = useUser();
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const [organizationId, setOrganizationIdState] = useState<string | null>(null);
  const [branchId, setBranchIdState] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const membershipsRef = useRef(memberships);
  const organizationIdRef = useRef(organizationId);
  membershipsRef.current = memberships;
  organizationIdRef.current = organizationId;

  const loadMemberships = useCallback(async () => {
    const data = await apiFetch<
      {
        organizationId: string;
        role: string;
        organization: { id: string; name: string; branches: { id: string; name: string }[] };
      }[]
    >("/tenants/organizations");
    const mapped: OrgMembership[] = data.map((m) => ({
      organizationId: m.organizationId,
      role: m.role,
      organization: m.organization,
    }));
    setMemberships(mapped);
    return mapped;
  }, []);

  const applyTenantSelection = useCallback(
    (
      mapped: OrgMembership[],
      preferred?: { organizationId?: string; branchId?: string | null },
    ) => {
      const next =
        preferred?.organizationId &&
        findMembership(mapped, preferred.organizationId)
          ? resolveTenantSelection(
              mapped,
              preferred.organizationId,
              preferred.branchId,
            )
          : pickInitialTenant(mapped, readStoredTenant());

      setOrganizationIdState(next.organizationId);
      setBranchIdState(next.branchId);
      if (next.organizationId) {
        writeStoredTenant({
          organizationId: next.organizationId,
          branchId: next.branchId,
        });
      }
      return next;
    },
    [],
  );

  const refreshMemberships = useCallback(
    async (options?: { organizationId?: string; branchId?: string | null }) => {
      const mapped = await loadMemberships();
      applyTenantSelection(mapped, options);
      return mapped;
    },
    [loadMemberships, applyTenantSelection],
  );

  useEffect(() => {
    if (authLoading) return;

    if (isOnboardingRoute) {
      setLoading(false);
      return;
    }

    loadMemberships()
      .then((mapped) => {
        applyTenantSelection(mapped);
      })
      .catch(() => setMemberships([]))
      .finally(() => setLoading(false));
  }, [authLoading, isOnboardingRoute, loadMemberships, applyTenantSelection]);

  const role =
    memberships.find((m) => m.organizationId === organizationId)?.role ?? null;

  const persist = useCallback((orgId: string | null, brId: string | null) => {
    if (orgId) {
      writeStoredTenant({ organizationId: orgId, branchId: brId });
    }
  }, []);

  const setOrganizationId = useCallback(
    (id: string) => {
      const next = resolveOrganizationChange(membershipsRef.current, id);
      setOrganizationIdState(next.organizationId);
      setBranchIdState(next.branchId);
      persist(next.organizationId, next.branchId);
    },
    [persist],
  );

  const setBranchId = useCallback((id: string) => {
    const orgId = organizationIdRef.current;
    const resolved = resolveBranchChange(membershipsRef.current, orgId, id);
    setBranchIdState(resolved);
    if (orgId) {
      persist(orgId, resolved);
    }
  }, [persist]);

  const value = useMemo(
    () => ({
      organizationId,
      branchId,
      role,
      setOrganizationId,
      setBranchId,
      memberships,
      loading,
      refreshMemberships,
    }),
    [
      organizationId,
      branchId,
      role,
      setOrganizationId,
      setBranchId,
      memberships,
      loading,
      refreshMemberships,
    ],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}

export function useTenantHeaders() {
  const { organizationId, branchId } = useTenant();
  return useMemo(
    () => ({
      organizationId: organizationId!,
      branchId: branchId ?? undefined,
    }),
    [organizationId, branchId],
  );
}

export type { OrgMembership };

"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { roleCanAccessPath, getDefaultRouteForRole } from "@erp/utils";
import { LoadingState } from "@erp/ui";
import { useTenant } from "@/lib/tenant-context";

export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, loading } = useTenant();

  useEffect(() => {
    if (loading) return;
    if (!role) {
      router.replace("/onboarding");
      return;
    }
    if (!roleCanAccessPath(role, pathname)) {
      router.replace(getDefaultRouteForRole(role));
    }
  }, [pathname, role, loading, router]);

  if (loading) {
    return <LoadingState label="Loading…" />;
  }

  if (!role) {
    return <LoadingState label="Redirecting…" />;
  }

  if (!roleCanAccessPath(role, pathname)) {
    return <LoadingState label="Redirecting…" />;
  }

  return <>{children}</>;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box } from "@chakra-ui/react";
import { LoadingState } from "@erp/ui";
import { useUser } from "@propelauth/nextjs/client";
import { apiFetch } from "@/lib/api-client";
import { syncUserAfterLogin } from "@/lib/auth";
import { getDefaultRouteForRole } from "@erp/utils";
import { Role } from "@erp/types";

export default function HomePage() {
  const router = useRouter();
  const { loading, accessToken } = useUser();

  useEffect(() => {
    if (loading) return;
    if (!accessToken) {
      router.replace("/auth/login");
      return;
    }

    (async () => {
      await syncUserAfterLogin(undefined, accessToken);
      const status = await apiFetch<{
        canAccessApp: boolean;
        pendingRequest: { id: string } | null;
      }>("/tenants/onboarding/status");

      if (!status.canAccessApp) {
        router.replace(status.pendingRequest ? "/onboarding/pending" : "/onboarding");
        return;
      }

      const memberships = await apiFetch<{ role: string }[]>("/tenants/organizations");
      const role = memberships[0]?.role ?? Role.OWNER;
      router.replace(getDefaultRouteForRole(role));
    })().catch(() => router.replace("/onboarding"));
  }, [loading, accessToken, router]);

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center">
      <LoadingState label="Redirecting…" />
    </Box>
  );
}

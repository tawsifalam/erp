"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Box } from "@chakra-ui/react";
import { LoadingState } from "@erp/ui";
import { useUser } from "@propelauth/nextjs/client";
import { apiFetch } from "@/lib/api-client";
import { syncUserAfterLogin } from "@/lib/auth";

type OnboardingStatus = {
  hasMembership: boolean;
  canAccessApp: boolean;
  pendingRequest: { id: string } | null;
};

export function TenantGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { loading: authLoading, accessToken } = useUser();
  const [ready, setReady] = useState(false);

  const checkAccess = useCallback(async () => {
    if (!accessToken) return;
    await syncUserAfterLogin(undefined, accessToken);
    const status = await apiFetch<OnboardingStatus>("/tenants/onboarding/status");
    if (!status.canAccessApp) {
      if (status.pendingRequest) {
        router.replace("/onboarding/pending");
      } else {
        router.replace("/onboarding");
      }
      return;
    }
    setReady(true);
  }, [accessToken, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      router.replace("/auth/login");
      return;
    }
    checkAccess().catch(() => router.replace("/onboarding"));
  }, [authLoading, accessToken, checkAccess, router]);

  if (authLoading || !ready) {
    return (
      <Box flex="1" display="flex" alignItems="center" justifyContent="center" p={8}>
        <LoadingState label="Checking access…" />
      </Box>
    );
  }

  return <>{children}</>;
}

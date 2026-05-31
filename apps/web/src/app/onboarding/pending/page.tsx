"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Stack, Text } from "@chakra-ui/react";
import { useUser } from "@propelauth/nextjs/client";
import { apiFetch } from "@/lib/api-client";
import { syncUserAfterLogin } from "@/lib/auth";
import { useTenant } from "@/lib/tenant-context";
import { getDefaultRouteForRole } from "@erp/utils";
import { Role } from "@erp/types";
import { appToast } from "@/lib/app-toast";
import { ContentCard, LoadingState } from "@erp/ui";

type OnboardingStatus = {
  hasMembership: boolean;
  canAccessApp: boolean;
  pendingRequest: {
    id: string;
    organizationId: string;
    organizationName: string;
    message?: string | null;
    createdAt: string;
  } | null;
};

export default function OnboardingPendingPage() {
  const router = useRouter();
  const { loading: authLoading, accessToken } = useUser();
  const tenant = useTenant();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!accessToken) return;
    await syncUserAfterLogin(undefined, accessToken);
    const data = await apiFetch<OnboardingStatus>("/tenants/onboarding/status");
    if (data.canAccessApp) {
      await tenant.refreshMemberships();
      const memberships = await apiFetch<{ role: string }[]>("/tenants/organizations");
      const role = memberships[0]?.role ?? Role.FRONT_DESK;
      router.replace(getDefaultRouteForRole(role));
      return;
    }
    if (!data.pendingRequest) {
      router.replace("/onboarding");
      return;
    }
    setStatus(data);
    setLoading(false);
  }, [accessToken, router, tenant]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    loadStatus().catch(() => setLoading(false));
  }, [authLoading, accessToken, loadStatus]);

  useEffect(() => {
    if (!accessToken || loading) return;
    const interval = setInterval(() => {
      loadStatus().catch(console.error);
    }, 15000);
    return () => clearInterval(interval);
  }, [accessToken, loading, loadStatus]);

  const cancelRequest = async () => {
    if (!status?.pendingRequest) return;
    setCancelling(true);
    try {
      await apiFetch(`/tenants/join-requests/${status.pendingRequest.id}`, {
        method: "DELETE",
      });
      router.replace("/onboarding");
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to cancel request");
    } finally {
      setCancelling(false);
    }
  };

  if (authLoading || loading) {
    return (
      <ContentCard maxW="480px" w="full" p={8}>
        <LoadingState label="Checking request status…" />
      </ContentCard>
    );
  }

  const pending = status?.pendingRequest;

  return (
    <ContentCard maxW="480px" w="full" p={8}>
      <Text fontSize="2xl" fontWeight="bold" mb={2}>
        Waiting for approval
      </Text>
      <Text fontSize="sm" color="fg.muted" mb={6}>
        Your request to join{" "}
        <Text as="span" fontWeight="semibold" color="fg">
          {pending?.organizationName}
        </Text>{" "}
        is pending. An organization admin will review it, assign your role, and you will receive
        access automatically once approved.
      </Text>

      <Stack gap={3}>
        <Text fontSize="xs" color="fg.muted">
          This page refreshes automatically every 15 seconds.
        </Text>
        <Button variant="outline" onClick={cancelRequest} loading={cancelling}>
          Cancel request
        </Button>
        <Button variant="ghost" size="sm" onClick={() => router.push("/onboarding")}>
          Back to onboarding
        </Button>
      </Stack>
    </ContentCard>
  );
}

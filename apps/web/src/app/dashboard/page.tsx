"use client";

import { useEffect, useState } from "react";
import { Box, SimpleGrid, Stat, Text } from "@chakra-ui/react";
import { useUser } from "@propelauth/nextjs/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";
import { syncUserAfterLogin } from "@/lib/auth";

type Dashboard = {
  occupancyPct: number;
  activeReservations: number;
  revenueToday: number;
  lowStockAlerts: number;
};

export default function DashboardPage() {
  const { loading: authLoading } = useUser();
  const tenant = useTenantHeaders();
  const [data, setData] = useState<Dashboard | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (authLoading || synced) return;
    syncUserAfterLogin()
      .catch(console.error)
      .finally(() => setSynced(true));
  }, [authLoading, synced]);

  useEffect(() => {
    if (!tenant.organizationId) return;
    apiFetch<Dashboard>("/reporting/dashboard", { tenant }).then(setData).catch(console.error);
  }, [tenant.organizationId, tenant.branchId]);

  return (
    <DashboardShell title="Dashboard">
      <PageHeader title="Overview" description="Today's property metrics" />
      <SimpleGrid columns={{ base: 1, md: 4 }} gap={4}>
        <Stat.Root>
          <Stat.Label>Occupancy</Stat.Label>
          <Stat.ValueText>{data?.occupancyPct ?? "—"}%</Stat.ValueText>
        </Stat.Root>
        <Stat.Root>
          <Stat.Label>Active reservations</Stat.Label>
          <Stat.ValueText>{data?.activeReservations ?? "—"}</Stat.ValueText>
        </Stat.Root>
        <Stat.Root>
          <Stat.Label>Revenue today</Stat.Label>
          <Stat.ValueText>${data?.revenueToday?.toFixed(2) ?? "—"}</Stat.ValueText>
        </Stat.Root>
        <Stat.Root>
          <Stat.Label>Low stock alerts</Stat.Label>
          <Stat.ValueText>{data?.lowStockAlerts ?? "—"}</Stat.ValueText>
        </Stat.Root>
      </SimpleGrid>
      {!tenant.organizationId && (
        <Text mt={4} color="fg.muted">
          Sign in and select an organization to load metrics.
        </Text>
      )}
    </DashboardShell>
  );
}

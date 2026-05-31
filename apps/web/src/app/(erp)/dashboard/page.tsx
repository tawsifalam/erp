"use client";

import { useEffect, useState } from "react";
import { Box, SimpleGrid, Stack, Stat, Text } from "@chakra-ui/react";
import { useUser } from "@propelauth/nextjs/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader, LoadingState } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";
import { syncUserAfterLogin } from "@/lib/auth";

type Dashboard = {
  occupancyPct: number;
  activeReservations: number;
  revenueToday: number;
  lowStockAlerts: number;
  lowStockItems: {
    sku: string;
    name: string;
    unit: string;
    currentStock: number;
    lowStockThreshold: number;
  }[];
};

export default function DashboardPage() {
  const { loading: authLoading, accessToken } = useUser();
  const tenant = useTenantHeaders();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (authLoading || synced || !accessToken) return;
    syncUserAfterLogin(undefined, accessToken)
      .catch(console.error)
      .finally(() => setSynced(true));
  }, [authLoading, accessToken, synced]);

  useEffect(() => {
    if (!tenant.organizationId || !tenant.branchId) return;
    setLoading(true);
    setError(null);
    apiFetch<Dashboard>("/reporting/dashboard", { tenant })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenant.organizationId, tenant.branchId]);

  return (
    <DashboardShell title="Dashboard">
      <PageHeader title="Overview" description="Today's property metrics" />
      {!tenant.branchId && tenant.organizationId && (
        <Text mb={3} fontSize="sm" color="orange.600">
          Select a branch in the header to load branch metrics.
        </Text>
      )}
      {loading && <LoadingState />}
      {error && (
        <Text color="red.500" mb={4}>
          {error}
        </Text>
      )}
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
          <Stat.Label>Revenue today (POS)</Stat.Label>
          <Stat.ValueText>{data?.revenueToday?.toFixed(2) ?? "—"}</Stat.ValueText>
        </Stat.Root>
        <Stat.Root>
          <Stat.Label>Low stock alerts</Stat.Label>
          <Stat.ValueText>{data?.lowStockAlerts ?? "—"}</Stat.ValueText>
        </Stat.Root>
      </SimpleGrid>

      {data && data.lowStockItems.length > 0 && (
        <Box mt={6} bg="white" borderRadius="md" p={4}>
          <Text fontWeight="semibold" mb={2}>
            Low stock items
          </Text>
          <Stack gap={1} fontSize="sm">
            {data.lowStockItems.map((i) => (
              <Text key={i.sku}>
                {i.name} ({i.sku}): {i.currentStock.toFixed(2)} {i.unit} — threshold{" "}
                {i.lowStockThreshold}
              </Text>
            ))}
          </Stack>
        </Box>
      )}

      {!tenant.organizationId && (
        <Text mt={4} color="fg.muted">
          Sign in and select an organization to load metrics.
        </Text>
      )}
    </DashboardShell>
  );
}

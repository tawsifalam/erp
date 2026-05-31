"use client";

import { BranchRequiredNotice } from "@/components/branch-required-notice";
import { DashboardQuickLinks } from "@/components/dashboard-quick-links";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePageHeader } from "@/components/module-page-header";
import {
  BuildingIcon,
  ChartIcon,
  PackageIcon,
  UtensilsIcon,
} from "@/components/sidebar-icons";
import { useTenantHeaders, useTenant } from "@/lib/tenant-context";
import { appToast } from "@/lib/app-toast";
import { apiFetch } from "@/lib/api-client";
import {
  ContentCard,
  EmptyState,
  LoadingState,
  StatCard,
} from "@erp/ui";
import { Box, Stack, Table, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

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
  const tenant = useTenantHeaders();
  const { role } = useTenant();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenant.organizationId || !tenant.branchId) return;
    setLoading(true);
    apiFetch<Dashboard>("/reporting/dashboard", { tenant })
      .then(setData)
      .catch((e: Error) => appToast.error(e.message))
      .finally(() => setLoading(false));
  }, [tenant.organizationId, tenant.branchId]);

  const needsBranch = Boolean(tenant.organizationId && !tenant.branchId);
  const needsOrg = !tenant.organizationId;

  return (
    <DashboardShell>
      <ModulePageHeader />

      {needsOrg && (
        <EmptyState
          title="No organization selected"
          description="Sign in and complete onboarding, then pick an organization in the header to load metrics."
          icon="🏢"
        />
      )}

      {needsBranch && <BranchRequiredNotice />}

      {loading && <LoadingState label="Loading dashboard metrics…" />}

      {!needsOrg && !needsBranch && !loading && (
        <>
          <Box
            display="grid"
            gridTemplateColumns={{ base: "1fr", md: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }}
            gap={4}
          >
            <StatCard
              label="Occupancy"
              value={data ? `${data.occupancyPct}%` : "—"}
              helper="Rooms occupied vs available"
              icon={<BuildingIcon boxSize={5} aria-hidden />}
            />
            <StatCard
              label="Active reservations"
              value={data?.activeReservations ?? "—"}
              helper="Confirmed and checked in"
              icon={<ChartIcon boxSize={5} aria-hidden />}
            />
            <StatCard
              label="Revenue today"
              value={data ? `$${data.revenueToday.toFixed(2)}` : "—"}
              helper="POS sales for this branch"
              icon={<UtensilsIcon boxSize={5} aria-hidden />}
            />
            <StatCard
              label="Low stock alerts"
              value={data?.lowStockAlerts ?? "—"}
              helper="Items below reorder threshold"
              icon={<PackageIcon boxSize={5} aria-hidden />}
            />
          </Box>

          {data && data.lowStockItems.length > 0 && (
            <ContentCard mt={6}>
              <Text fontWeight="semibold" mb={3}>
                Low stock items
              </Text>
              <Text fontSize="sm" color="fg.muted" mb={4}>
                Restock these items soon to avoid running out during service.
              </Text>
              <Box overflowX="auto">
                <Table.Root size="sm">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Item</Table.ColumnHeader>
                      <Table.ColumnHeader>SKU</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">On hand</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">Threshold</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {data.lowStockItems.map((item) => (
                      <Table.Row key={item.sku}>
                        <Table.Cell>{item.name}</Table.Cell>
                        <Table.Cell fontFamily="mono" fontSize="xs">
                          {item.sku}
                        </Table.Cell>
                        <Table.Cell textAlign="end">
                          {item.currentStock.toFixed(2)} {item.unit}
                        </Table.Cell>
                        <Table.Cell textAlign="end">{item.lowStockThreshold}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
            </ContentCard>
          )}

          {data && data.lowStockAlerts === 0 && (
            <ContentCard mt={6} py={6}>
              <Stack gap={1} textAlign="center">
                <Text fontWeight="medium">All stock levels look good</Text>
                <Text fontSize="sm" color="fg.muted">
                  No items are below their reorder threshold right now.
                </Text>
              </Stack>
            </ContentCard>
          )}

          <DashboardQuickLinks role={role} />
        </>
      )}
    </DashboardShell>
  );
}

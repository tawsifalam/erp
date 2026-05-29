"use client";

import { useEffect, useState } from "react";
import { Box, Table, Text } from "@chakra-ui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";

type Item = { id: string; name: string; sku: string; unit: string; currentStock: number };

export default function InventoryPage() {
  const tenant = useTenantHeaders();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    apiFetch<Item[]>(`/inventory/items?branchId=${tenant.branchId}`, { tenant })
      .then(setItems)
      .catch(console.error);
  }, [tenant.branchId, tenant.organizationId]);

  return (
    <DashboardShell title="Inventory">
      <PageHeader title="Stock" description="Ledger-based quantities (IN − OUT)" />
      <Box bg="white" borderRadius="md" p={4}>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>SKU</Table.ColumnHeader>
              <Table.ColumnHeader>Name</Table.ColumnHeader>
              <Table.ColumnHeader>On hand</Table.ColumnHeader>
              <Table.ColumnHeader>Unit</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((i) => (
              <Table.Row key={i.id}>
                <Table.Cell>{i.sku}</Table.Cell>
                <Table.Cell>{i.name}</Table.Cell>
                <Table.Cell>{i.currentStock}</Table.Cell>
                <Table.Cell>{i.unit}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </DashboardShell>
  );
}

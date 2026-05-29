"use client";

import { useEffect, useState } from "react";
import { Box, Button, Table, Text } from "@chakra-ui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader, StatusBadge, MoneyText } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  tableNumber?: string;
};

export default function PosPage() {
  const tenant = useTenantHeaders();
  const [orders, setOrders] = useState<Order[]>([]);

  const load = () => {
    apiFetch<Order[]>(`/pos/orders?branchId=${tenant.branchId}`, { tenant })
      .then(setOrders)
      .catch(console.error);
  };

  useEffect(load, [tenant.branchId, tenant.organizationId]);

  return (
    <DashboardShell title="POS">
      <PageHeader title="Orders" description="Cashier register" />
      <Button size="sm" mb={4} onClick={load}>
        Refresh
      </Button>
      <Box bg="white" borderRadius="md" p={4}>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Table</Table.ColumnHeader>
              <Table.ColumnHeader>Total</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
              <Table.ColumnHeader>Payment</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {orders.map((o) => (
              <Table.Row key={o.id}>
                <Table.Cell>{o.tableNumber ?? "—"}</Table.Cell>
                <Table.Cell>
                  <MoneyText amount={Number(o.totalAmount)} />
                </Table.Cell>
                <Table.Cell>
                  <StatusBadge status={o.status} />
                </Table.Cell>
                <Table.Cell>
                  <StatusBadge status={o.paymentStatus} />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </DashboardShell>
  );
}

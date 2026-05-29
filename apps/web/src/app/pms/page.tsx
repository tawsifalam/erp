"use client";

import { useEffect, useState } from "react";
import { Box, Button, Table, Text } from "@chakra-ui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader, StatusBadge } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";

type Reservation = {
  id: string;
  status: string;
  checkIn: string;
  checkOut: string;
  guest: { fullName: string };
  room: { roomNumber: string };
};

export default function PmsPage() {
  const tenant = useTenantHeaders();
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const load = () => {
    if (!tenant.organizationId) return;
    apiFetch<Reservation[]>(`/pms/reservations?branchId=${tenant.branchId}`, { tenant })
      .then(setReservations)
      .catch(console.error);
  };

  useEffect(load, [tenant.organizationId, tenant.branchId]);

  return (
    <DashboardShell title="PMS">
      <PageHeader title="Reservations" description="Guest stays and room assignments" />
      <Button size="sm" mb={4} onClick={load}>
        Refresh
      </Button>
      <Box overflowX="auto" bg="white" borderRadius="md" p={4}>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Guest</Table.ColumnHeader>
              <Table.ColumnHeader>Room</Table.ColumnHeader>
              <Table.ColumnHeader>Check-in</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {reservations.map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell>{r.guest.fullName}</Table.Cell>
                <Table.Cell>{r.room.roomNumber}</Table.Cell>
                <Table.Cell>{new Date(r.checkIn).toLocaleDateString()}</Table.Cell>
                <Table.Cell>
                  <StatusBadge status={r.status} />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {reservations.length === 0 && (
          <Text color="fg.muted" py={4}>
            No reservations. Use the API or seed data to add bookings.
          </Text>
        )}
      </Box>
    </DashboardShell>
  );
}

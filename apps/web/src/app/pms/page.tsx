"use client";

import { useEffect, useState, useCallback } from "react";
import { Box, Button, Table, Text, Input, Stack, Flex, NativeSelect } from "@chakra-ui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader, StatusBadge, EmptyState } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";

type Room = { id: string; roomNumber: string; status: string; basePrice: string; roomType: { name: string } };
type Guest = { id: string; fullName: string; phone?: string; email?: string };
type Reservation = {
  id: string;
  status: string;
  checkIn: string;
  checkOut: string;
  totalAmount: string;
  guest: { fullName: string };
  room: { roomNumber: string };
};

export default function PmsPage() {
  const tenant = useTenantHeaders();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestForm, setGuestForm] = useState({ fullName: "", phone: "", email: "" });
  const [form, setForm] = useState({ guestId: "", roomId: "", checkIn: "", checkOut: "", totalAmount: "" });

  const load = useCallback(() => {
    if (!tenant.organizationId) return;
    apiFetch<Reservation[]>(`/pms/reservations?branchId=${tenant.branchId}`, { tenant }).then(setReservations).catch(console.error);
    apiFetch<Room[]>(`/pms/rooms?branchId=${tenant.branchId}`, { tenant }).then(setRooms).catch(console.error);
    apiFetch<Guest[]>("/pms/guests", { tenant }).then(setGuests).catch(console.error);
  }, [tenant.organizationId, tenant.branchId]);

  useEffect(load, [load]);

  const handleAction = async (id: string, action: "check-in" | "check-out" | "cancel") => {
    await apiFetch(`/pms/reservations/${id}/${action}`, {
      method: "PATCH",
      tenant,
    });
    load();
  };

  const handleCreateGuest = async () => {
    await apiFetch("/pms/guests", {
      method: "POST",
      tenant,
      body: JSON.stringify({
        fullName: guestForm.fullName,
        phone: guestForm.phone || undefined,
        email: guestForm.email || undefined,
      }),
    });
    setGuestForm({ fullName: "", phone: "", email: "" });
    setShowGuestForm(false);
    load();
  };

  const handleCreate = async () => {
    await apiFetch("/pms/reservations", {
      method: "POST",
      tenant,
      body: JSON.stringify({
        branchId: tenant.branchId,
        guestId: form.guestId,
        roomId: form.roomId,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        totalAmount: Number(form.totalAmount),
      }),
    });
    setShowForm(false);
    setForm({ guestId: "", roomId: "", checkIn: "", checkOut: "", totalAmount: "" });
    load();
  };

  return (
    <DashboardShell title="PMS">
      <PageHeader title="Reservations" description="Guest stays and room assignments" />
      <Flex gap={2} mb={4}>
        <Button size="sm" onClick={load}>Refresh</Button>
        <Button size="sm" colorPalette="blue" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Reservation"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowGuestForm(!showGuestForm)}>
          {showGuestForm ? "Cancel" : "+ New Guest"}
        </Button>
      </Flex>

      {showGuestForm && (
        <Box bg="white" borderRadius="md" p={4} mb={4}>
          <Stack gap={3}>
            <Flex gap={3} wrap="wrap">
              <Input
                size="sm"
                w="200px"
                placeholder="Full name"
                value={guestForm.fullName}
                onChange={(e) => setGuestForm({ ...guestForm, fullName: e.target.value })}
              />
              <Input
                size="sm"
                w="160px"
                placeholder="Phone"
                value={guestForm.phone}
                onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
              />
              <Input
                size="sm"
                w="200px"
                placeholder="Email"
                value={guestForm.email}
                onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
              />
            </Flex>
            <Button size="sm" colorPalette="green" w="fit-content" onClick={handleCreateGuest}>
              Save Guest
            </Button>
          </Stack>
        </Box>
      )}

      {showForm && (
        <Box bg="white" borderRadius="md" p={4} mb={4}>
          <Stack gap={3}>
            <Flex gap={3} wrap="wrap">
              <NativeSelect.Root size="sm" w="200px">
                <NativeSelect.Field value={form.guestId} onChange={(e) => setForm({ ...form, guestId: e.target.value })}>
                  <option value="">Select Guest</option>
                  {guests.map((g) => <option key={g.id} value={g.id}>{g.fullName}</option>)}
                </NativeSelect.Field>
              </NativeSelect.Root>
              <NativeSelect.Root size="sm" w="200px">
                <NativeSelect.Field value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                  <option value="">Select Room</option>
                  {rooms.filter((r) => r.status === "VACANT").map((r) => (
                    <option key={r.id} value={r.id}>{r.roomNumber} - {r.roomType.name}</option>
                  ))}
                </NativeSelect.Field>
              </NativeSelect.Root>
              <Input size="sm" w="160px" type="date" placeholder="Check-in" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
              <Input size="sm" w="160px" type="date" placeholder="Check-out" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
              <Input size="sm" w="120px" type="number" placeholder="Amount" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} />
            </Flex>
            <Button size="sm" colorPalette="green" w="fit-content" onClick={handleCreate}>
              Create Reservation
            </Button>
          </Stack>
        </Box>
      )}

      <Box overflowX="auto" bg="white" borderRadius="md" p={4} mb={6}>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Guest</Table.ColumnHeader>
              <Table.ColumnHeader>Room</Table.ColumnHeader>
              <Table.ColumnHeader>Check-in</Table.ColumnHeader>
              <Table.ColumnHeader>Check-out</Table.ColumnHeader>
              <Table.ColumnHeader>Amount</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
              <Table.ColumnHeader>Actions</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {reservations.map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell>{r.guest.fullName}</Table.Cell>
                <Table.Cell>{r.room.roomNumber}</Table.Cell>
                <Table.Cell>{new Date(r.checkIn).toLocaleDateString()}</Table.Cell>
                <Table.Cell>{new Date(r.checkOut).toLocaleDateString()}</Table.Cell>
                <Table.Cell>৳{Number(r.totalAmount).toLocaleString()}</Table.Cell>
                <Table.Cell><StatusBadge status={r.status} /></Table.Cell>
                <Table.Cell>
                  <Flex gap={1}>
                    {r.status === "CONFIRMED" && (
                      <Button size="xs" colorPalette="green" onClick={() => handleAction(r.id, "check-in")}>Check In</Button>
                    )}
                    {r.status === "CHECKED_IN" && (
                      <Button size="xs" colorPalette="orange" onClick={() => handleAction(r.id, "check-out")}>Check Out</Button>
                    )}
                    {(r.status === "CONFIRMED" || r.status === "INQUIRY") && (
                      <Button size="xs" colorPalette="red" variant="outline" onClick={() => handleAction(r.id, "cancel")}>Cancel</Button>
                    )}
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {reservations.length === 0 && <EmptyState message="No reservations found." />}
      </Box>

      <PageHeader title="Rooms" description="Current room status" />
      <Box overflowX="auto" bg="white" borderRadius="md" p={4}>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Room #</Table.ColumnHeader>
              <Table.ColumnHeader>Type</Table.ColumnHeader>
              <Table.ColumnHeader>Price/Night</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rooms.map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell fontWeight="medium">{r.roomNumber}</Table.Cell>
                <Table.Cell>{r.roomType.name}</Table.Cell>
                <Table.Cell>৳{Number(r.basePrice).toLocaleString()}</Table.Cell>
                <Table.Cell><StatusBadge status={r.status} /></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </DashboardShell>
  );
}

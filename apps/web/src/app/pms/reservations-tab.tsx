"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Input,
  NativeSelect,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { EmptyState, LoadingState, StatusBadge } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { Guest, Reservation, Room } from "@/lib/pms-types";

export function ReservationsTab({ tenant }: { tenant: TenantHeaders }) {
  const branchId = tenant.branchId;
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    guestId: "",
    roomId: "",
    checkIn: "",
    checkOut: "",
    totalAmount: "",
    status: "CONFIRMED" as "CONFIRMED" | "INQUIRY",
    paidAmount: "",
  });
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const load = useCallback(async () => {
    if (!tenant.organizationId || !branchId) return;
    setLoading(true);
    setError(null);
    try {
      const [resData, guestData] = await Promise.all([
        apiFetch<Reservation[]>(`/pms/reservations?branchId=${branchId}`, { tenant }),
        apiFetch<Guest[]>("/pms/guests", { tenant }),
      ]);
      setReservations(resData);
      setGuests(guestData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reservations");
    } finally {
      setLoading(false);
    }
  }, [tenant.organizationId, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const fetchAvailability = useCallback(async () => {
    if (!branchId || !form.checkIn || !form.checkOut) {
      setAvailableRooms([]);
      return;
    }
    try {
      const rooms = await apiFetch<Room[]>(
        `/pms/availability?branchId=${branchId}&checkIn=${form.checkIn}T14:00:00Z&checkOut=${form.checkOut}T11:00:00Z`,
        { tenant },
      );
      setAvailableRooms(rooms);
      if (form.roomId && !rooms.some((r) => r.id === form.roomId)) {
        setForm((f) => ({ ...f, roomId: "" }));
      }
    } catch {
      setAvailableRooms([]);
    }
  }, [branchId, form.checkIn, form.checkOut, form.roomId, tenant]);

  useEffect(() => {
    if (form.status === "CONFIRMED") {
      fetchAvailability();
    } else {
      setAvailableRooms([]);
    }
  }, [form.checkIn, form.checkOut, form.status, fetchAvailability]);

  const handleAction = async (
    id: string,
    action: "check-in" | "check-out" | "cancel" | "confirm",
  ) => {
    if (!branchId) return;
    const path =
      action === "confirm"
        ? `/pms/reservations/${id}/confirm?branchId=${branchId}`
        : `/pms/reservations/${id}/${action}?branchId=${branchId}`;
    await apiFetch(path, { method: "PATCH", tenant });
    load();
  };

  const handleCreate = async () => {
    if (!branchId) return;
    if (!form.guestId || !form.roomId || !form.checkIn || !form.checkOut) {
      setError("Guest, room, check-in, and check-out are required.");
      return;
    }
    if (form.checkOut <= form.checkIn) {
      setError("Check-out must be after check-in.");
      return;
    }
    setError(null);
    try {
      await apiFetch("/pms/reservations", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          branchId,
          guestId: form.guestId,
          roomId: form.roomId,
          checkIn: `${form.checkIn}T14:00:00Z`,
          checkOut: `${form.checkOut}T11:00:00Z`,
          totalAmount: Number(form.totalAmount),
          paidAmount: form.paidAmount ? Number(form.paidAmount) : undefined,
          status: form.status,
        }),
      });
      setShowForm(false);
      setForm({
        guestId: "",
        roomId: "",
        checkIn: "",
        checkOut: "",
        totalAmount: "",
        status: "CONFIRMED",
        paidAmount: "",
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create reservation");
    }
  };

  const savePayment = async () => {
    if (!branchId || !paymentId) return;
    await apiFetch(`/pms/reservations/${paymentId}/payment?branchId=${branchId}`, {
      method: "PATCH",
      tenant,
      body: JSON.stringify({ paidAmount: Number(paymentAmount) }),
    });
    setPaymentId(null);
    setPaymentAmount("");
    load();
  };

  const roomOptions =
    form.status === "INQUIRY"
      ? availableRooms.length > 0
        ? availableRooms
        : []
      : availableRooms;

  const canSubmit =
    Boolean(form.guestId && form.roomId && form.checkIn && form.checkOut) &&
    form.checkOut > form.checkIn;

  if (!branchId) {
    return (
      <Text color="fg.muted" fontSize="sm">
        Select a branch in the header to manage reservations.
      </Text>
    );
  }

  return (
    <Box>
      {error && (
        <Text color="red.500" mb={3} fontSize="sm">
          {error}
        </Text>
      )}
      <Flex gap={2} mb={4}>
        <Button size="sm" onClick={load}>
          Refresh
        </Button>
        <Button size="sm" colorPalette="blue" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New reservation"}
        </Button>
      </Flex>

      {showForm && (
        <Box bg="white" borderRadius="md" p={4} mb={4}>
          <Stack gap={3}>
            <Flex gap={2} wrap="wrap">
              <NativeSelect.Root size="sm" w="160px">
                <NativeSelect.Field
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as "CONFIRMED" | "INQUIRY",
                    })
                  }
                >
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="INQUIRY">Inquiry (hold)</option>
                </NativeSelect.Field>
              </NativeSelect.Root>
              <NativeSelect.Root size="sm" w="200px">
                <NativeSelect.Field
                  value={form.guestId}
                  onChange={(e) => setForm({ ...form, guestId: e.target.value })}
                >
                  <option value="">Guest</option>
                  {guests.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.fullName}
                    </option>
                  ))}
                </NativeSelect.Field>
              </NativeSelect.Root>
              <Input
                size="sm"
                w="150px"
                type="date"
                value={form.checkIn}
                onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
              />
              <Input
                size="sm"
                w="150px"
                type="date"
                value={form.checkOut}
                onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
              />
              {form.status === "CONFIRMED" && (
                <NativeSelect.Root size="sm" w="220px">
                  <NativeSelect.Field
                    value={form.roomId}
                    onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                  >
                    <option value="">Available room</option>
                    {roomOptions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.roomNumber} — {r.roomType.name}
                      </option>
                    ))}
                  </NativeSelect.Field>
                </NativeSelect.Root>
              )}
              <Input
                size="sm"
                w="100px"
                type="number"
                placeholder="Total"
                value={form.totalAmount}
                onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
              />
              <Input
                size="sm"
                w="100px"
                type="number"
                placeholder="Paid"
                value={form.paidAmount}
                onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
              />
            </Flex>
            {form.status === "INQUIRY" && (
              <InquiryRoomPicker
                tenant={tenant}
                branchId={branchId}
                value={form.roomId}
                onChange={(roomId) => setForm((f) => ({ ...f, roomId }))}
              />
            )}
            <Button
              size="sm"
              colorPalette="green"
              w="fit-content"
              disabled={!canSubmit}
              onClick={handleCreate}
            >
              Create
            </Button>
            {!canSubmit && (
              <Text fontSize="xs" color="fg.muted">
                Select guest, room, and valid check-in/check-out dates.
              </Text>
            )}
          </Stack>
        </Box>
      )}

      {loading && <LoadingState />}
      {!loading && (
        <Box bg="white" borderRadius="md" p={4} overflowX="auto">
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Guest</Table.ColumnHeader>
                <Table.ColumnHeader>Room</Table.ColumnHeader>
                <Table.ColumnHeader>Check-in</Table.ColumnHeader>
                <Table.ColumnHeader>Check-out</Table.ColumnHeader>
                <Table.ColumnHeader>Total</Table.ColumnHeader>
                <Table.ColumnHeader>Paid</Table.ColumnHeader>
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
                  <Table.Cell>৳{Number(r.paidAmount ?? 0).toLocaleString()}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={r.status} />
                  </Table.Cell>
                  <Table.Cell>
                    <Flex gap={1} wrap="wrap">
                      {r.status === "INQUIRY" && (
                        <Button
                          size="xs"
                          colorPalette="blue"
                          onClick={() => handleAction(r.id, "confirm")}
                        >
                          Confirm
                        </Button>
                      )}
                      {r.status === "CONFIRMED" && (
                        <Button
                          size="xs"
                          colorPalette="green"
                          onClick={() => handleAction(r.id, "check-in")}
                        >
                          Check in
                        </Button>
                      )}
                      {r.status === "CHECKED_IN" && (
                        <Button
                          size="xs"
                          colorPalette="orange"
                          onClick={() => handleAction(r.id, "check-out")}
                        >
                          Check out
                        </Button>
                      )}
                      {(r.status === "CONFIRMED" || r.status === "INQUIRY") && (
                        <Button
                          size="xs"
                          colorPalette="red"
                          variant="outline"
                          onClick={() => handleAction(r.id, "cancel")}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setPaymentId(r.id);
                          setPaymentAmount(String(r.paidAmount ?? 0));
                        }}
                      >
                        Payment
                      </Button>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          {reservations.length === 0 && (
            <EmptyState message="No reservations for this branch." />
          )}
        </Box>
      )}

      {paymentId && (
        <Box
          position="fixed"
          inset={0}
          bg="blackAlpha.400"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={10}
        >
          <Box bg="white" p={6} borderRadius="md" minW="280px">
            <Text fontWeight="semibold" mb={3}>
              Record payment
            </Text>
            <Input
              size="sm"
              type="number"
              mb={3}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <Flex gap={2}>
              <Button size="sm" colorPalette="green" onClick={savePayment}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPaymentId(null)}>
                Cancel
              </Button>
            </Flex>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function InquiryRoomPicker({
  tenant,
  branchId,
  value,
  onChange,
}: {
  tenant: TenantHeaders;
  branchId: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    apiFetch<Room[]>(`/pms/rooms?branchId=${branchId}`, { tenant })
      .then(setRooms)
      .catch(() => setRooms([]));
  }, [branchId, tenant.organizationId]);

  return (
    <NativeSelect.Root size="sm" w="220px">
      <NativeSelect.Field value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select room for inquiry</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.roomNumber} — {r.roomType.name} ({r.status})
          </option>
        ))}
      </NativeSelect.Field>
    </NativeSelect.Root>
  );
}

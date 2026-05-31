"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Input,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import { EmptyState, LoadingState, StatusBadge } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { Guest, Reservation, Room } from "@/lib/pms-types";
import { appToast } from "@/lib/app-toast";

export function ReservationsTab({ tenant }: { tenant: TenantHeaders }) {
  const branchId = tenant.branchId;
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    guestId: "",
    roomId: "",
    checkIn: "",
    checkOut: "",
    totalAmount: "",
  });
  const [editRooms, setEditRooms] = useState<Room[]>([]);

  const load = useCallback(async () => {
    if (!tenant.organizationId || !branchId) return;
    setLoading(true);
    try {
      const [resData, guestData] = await Promise.all([
        apiFetch<Reservation[]>(`/pms/reservations?branchId=${branchId}`, { tenant }),
        apiFetch<Guest[]>("/pms/guests", { tenant }),
      ]);
      setReservations(resData);
      setGuests(guestData);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load reservations");
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

  const fetchEditAvailability = useCallback(async () => {
    if (!branchId || !editId || !editForm.checkIn || !editForm.checkOut) {
      setEditRooms([]);
      return;
    }
    try {
      const rooms = await apiFetch<Room[]>(
        `/pms/availability?branchId=${branchId}&checkIn=${editForm.checkIn}T14:00:00Z&checkOut=${editForm.checkOut}T11:00:00Z&excludeReservationId=${editId}`,
        { tenant },
      );
      setEditRooms(rooms);
    } catch {
      setEditRooms([]);
    }
  }, [branchId, editId, editForm.checkIn, editForm.checkOut, tenant]);

  useEffect(() => {
    if (editId) fetchEditAvailability();
  }, [editId, editForm.checkIn, editForm.checkOut, fetchEditAvailability]);

  const startEdit = (r: Reservation) => {
    if (r.status !== "INQUIRY" && r.status !== "CONFIRMED") return;
    const guestId =
      r.guest.id ?? guests.find((g) => g.fullName === r.guest.fullName)?.id ?? "";
    const roomId = r.room.id ?? "";
    setEditId(r.id);
    setEditForm({
      guestId,
      roomId,
      checkIn: r.checkIn.slice(0, 10),
      checkOut: r.checkOut.slice(0, 10),
      totalAmount: String(r.totalAmount),
    });
  };

  const saveEdit = async () => {
    if (!branchId || !editId) return;
    if (!editForm.guestId || !editForm.roomId || !editForm.checkIn || !editForm.checkOut) {
      appToast.error("Guest, room, and dates are required.");
      return;
    }
    try {
      await apiFetch(`/pms/reservations/${editId}?branchId=${branchId}`, {
        method: "PATCH",
        tenant,
        body: JSON.stringify({
          guestId: editForm.guestId,
          roomId: editForm.roomId,
          checkIn: `${editForm.checkIn}T14:00:00Z`,
          checkOut: `${editForm.checkOut}T11:00:00Z`,
          totalAmount: Number(editForm.totalAmount),
        }),
      });
      setEditId(null);
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to update reservation");
    }
  };

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
      appToast.error("Guest, room, check-in, and check-out are required.");
      return;
    }
    if (form.checkOut <= form.checkIn) {
      appToast.error("Check-out must be after check-in.");
      return;
    }
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
      appToast.error(e instanceof Error ? e.message : "Failed to create reservation");
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
              <AppSelect
                width="160px"
                items={[
                  { value: "CONFIRMED", label: "Confirmed" },
                  { value: "INQUIRY", label: "Inquiry (hold)" },
                ]}
                value={form.status}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    status: v as "CONFIRMED" | "INQUIRY",
                  })
                }
              />
              <AppSelect
                width="200px"
                items={[
                  { value: "", label: "Guest" },
                  ...guests.map((g) => ({ value: g.id, label: g.fullName })),
                ]}
                value={form.guestId}
                onValueChange={(v) => setForm({ ...form, guestId: v })}
                placeholder="Guest"
              />
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
                <AppSelect
                  width="220px"
                  items={[
                    { value: "", label: "Available room" },
                    ...roomOptions.map((r) => ({
                      value: r.id,
                      label: `${r.roomNumber} — ${r.roomType.name}`,
                    })),
                  ]}
                  value={form.roomId}
                  onValueChange={(v) => setForm({ ...form, roomId: v })}
                  placeholder="Available room"
                />
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
                      {(r.status === "INQUIRY" || r.status === "CONFIRMED") && (
                        <Button size="xs" variant="outline" onClick={() => startEdit(r)}>
                          Edit
                        </Button>
                      )}
                      {r.status !== "CHECKED_IN" && (
                        <Button
                          size="xs"
                          colorPalette="red"
                          variant="outline"
                          onClick={async () => {
                            if (!confirm("Delete this reservation record?")) return;
                            try {
                              await apiFetch(
                                `/pms/reservations/${r.id}?branchId=${branchId}`,
                                { method: "DELETE", tenant },
                              );
                              load();
                            } catch (e) {
                              appToast.error(
                                e instanceof Error ? e.message : "Cannot delete reservation",
                              );
                            }
                          }}
                        >
                          Delete
                        </Button>
                      )}
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

      {editId && (
        <Box
          position="fixed"
          inset={0}
          bg="blackAlpha.400"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={10}
        >
          <Box bg="white" p={6} borderRadius="md" minW="360px" maxW="90vw">
            <Text fontWeight="semibold" mb={3}>
              Edit reservation
            </Text>
            <Stack gap={3}>
              <AppSelect
                items={[
                  { value: "", label: "Guest" },
                  ...guests.map((g) => ({ value: g.id, label: g.fullName })),
                ]}
                value={editForm.guestId}
                onValueChange={(v) => setEditForm({ ...editForm, guestId: v })}
                placeholder="Guest"
              />
              <Flex gap={2}>
                <Input
                  size="sm"
                  type="date"
                  value={editForm.checkIn}
                  onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })}
                />
                <Input
                  size="sm"
                  type="date"
                  value={editForm.checkOut}
                  onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })}
                />
              </Flex>
              <AppSelect
                items={[
                  { value: "", label: "Available room" },
                  ...editRooms.map((room) => ({
                    value: room.id,
                    label: `${room.roomNumber} — ${room.roomType.name}`,
                  })),
                ]}
                value={editForm.roomId}
                onValueChange={(v) => setEditForm({ ...editForm, roomId: v })}
                placeholder="Available room"
              />
              <Input
                size="sm"
                type="number"
                placeholder="Total amount"
                value={editForm.totalAmount}
                onChange={(e) => setEditForm({ ...editForm, totalAmount: e.target.value })}
              />
              <Flex gap={2}>
                <Button size="sm" colorPalette="green" onClick={saveEdit}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditId(null)}>
                  Cancel
                </Button>
              </Flex>
            </Stack>
          </Box>
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
    <AppSelect
      width="220px"
      items={[
        { value: "", label: "Select room for inquiry" },
        ...rooms.map((r) => ({
          value: r.id,
          label: `${r.roomNumber} — ${r.roomType.name} (${r.status})`,
        })),
      ]}
      value={value}
      onValueChange={onChange}
      placeholder="Select room for inquiry"
    />
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Input,
  Table,
  Text,
} from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import { EmptyState, LoadingState, StatusBadge } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { Room, RoomType } from "@/lib/pms-types";
import { getSocket, joinBranch } from "@/lib/socket";
import { appToast } from "@/lib/app-toast";

const HOUSEKEEPING: Record<string, string[]> = {
  DIRTY: ["VACANT"],
  VACANT: ["MAINTENANCE"],
  MAINTENANCE: ["VACANT"],
};

export function RoomsTab({ tenant }: { tenant: TenantHeaders }) {
  const branchId = tenant.branchId;
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    roomNumber: "",
    roomTypeId: "",
    basePrice: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    roomNumber: "",
    roomTypeId: "",
    basePrice: "",
  });

  const load = useCallback(async () => {
    if (!tenant.organizationId || !branchId) return;
    setLoading(true);
    try {
      const [roomData, typeData] = await Promise.all([
        apiFetch<Room[]>(`/pms/rooms?branchId=${branchId}`, { tenant }),
        apiFetch<RoomType[]>("/pms/room-types", { tenant }),
      ]);
      setRooms(roomData);
      setRoomTypes(typeData);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  }, [tenant.organizationId, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!branchId) return;
    joinBranch(branchId);
    const socket = getSocket();
    if (!socket) return;
    const onStatus = ({ roomId, status }: { roomId: string; status: string }) => {
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, status } : r)),
      );
    };
    socket.on("room.status", onStatus);
    return () => {
      socket.off("room.status", onStatus);
    };
  }, [branchId]);

  const createRoom = async () => {
    if (!branchId || !form.roomNumber || !form.roomTypeId) return;
    await apiFetch("/pms/rooms", {
      method: "POST",
      tenant,
      body: JSON.stringify({
        branchId,
        roomNumber: form.roomNumber,
        roomTypeId: form.roomTypeId,
        basePrice: Number(form.basePrice) || 0,
      }),
    });
    setForm({ roomNumber: "", roomTypeId: "", basePrice: "" });
    load();
  };

  const setStatus = async (roomId: string, status: string) => {
    if (!branchId) return;
    try {
      await apiFetch(`/pms/rooms/${roomId}/status?branchId=${branchId}`, {
        method: "PATCH",
        tenant,
        body: JSON.stringify({ status }),
      });
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Status update failed");
    }
  };

  const startEdit = (room: Room) => {
    setEditId(room.id);
    setEditForm({
      roomNumber: room.roomNumber,
      roomTypeId: roomTypes.find((rt) => rt.name === room.roomType.name)?.id ?? "",
      basePrice: String(room.basePrice),
    });
  };

  const saveEdit = async () => {
    if (!branchId || !editId) return;
    try {
      await apiFetch(`/pms/rooms/${editId}?branchId=${branchId}`, {
        method: "PATCH",
        tenant,
        body: JSON.stringify({
          roomNumber: editForm.roomNumber,
          roomTypeId: editForm.roomTypeId || undefined,
          basePrice: Number(editForm.basePrice),
        }),
      });
      setEditId(null);
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to update room");
    }
  };

  if (!branchId) {
    return (
      <Text color="fg.muted" fontSize="sm">
        Select a branch in the header to manage rooms.
      </Text>
    );
  }

  return (
    <Box>
      <Box bg="white" borderRadius="md" p={4} mb={4}>
        <Text fontWeight="semibold" mb={3}>
          Add room
        </Text>
        <Flex gap={2} wrap="wrap" mb={3}>
          <Input
            size="sm"
            w="100px"
            placeholder="Room #"
            value={form.roomNumber}
            onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
          />
          <AppSelect
            width="180px"
            items={[
              { value: "", label: "Room type" },
              ...roomTypes.map((rt) => ({ value: rt.id, label: rt.name })),
            ]}
            value={form.roomTypeId}
            onValueChange={(v) => setForm({ ...form, roomTypeId: v })}
            placeholder="Room type"
          />
          <Input
            size="sm"
            w="120px"
            type="number"
            placeholder="Price/night"
            value={form.basePrice}
            onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
          />
          <Button size="sm" colorPalette="blue" onClick={createRoom}>
            Create
          </Button>
        </Flex>
        <Text fontSize="xs" color="fg.muted">
          Housekeeping: DIRTY → Clean (VACANT), VACANT ↔ MAINTENANCE. OCCUPIED is set by check-in/out only.
        </Text>
      </Box>
      {loading && <LoadingState />}
      {!loading && (
        <Box bg="white" borderRadius="md" p={4}>
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Room #</Table.ColumnHeader>
                <Table.ColumnHeader>Type</Table.ColumnHeader>
                <Table.ColumnHeader>Price</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader>Housekeeping</Table.ColumnHeader>
                <Table.ColumnHeader>Actions</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rooms.map((r) => (
                <Table.Row key={r.id}>
                  <Table.Cell fontWeight="medium">{r.roomNumber}</Table.Cell>
                  <Table.Cell>{r.roomType.name}</Table.Cell>
                  <Table.Cell>৳{Number(r.basePrice).toLocaleString()}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={r.status} />
                  </Table.Cell>
                  <Table.Cell>
                    <Flex gap={1} wrap="wrap">
                      {(HOUSEKEEPING[r.status] ?? []).map((next) => (
                        <Button
                          key={next}
                          size="xs"
                          variant="outline"
                          onClick={() => setStatus(r.id, next)}
                        >
                          → {next}
                        </Button>
                      ))}
                      {r.status === "OCCUPIED" && (
                        <Text fontSize="xs" color="fg.muted">
                          Use check-out
                        </Text>
                      )}
                      {r.status !== "OCCUPIED" && (
                        <Button size="xs" variant="outline" onClick={() => startEdit(r)}>
                          Edit
                        </Button>
                      )}
                      {r.status !== "OCCUPIED" && (
                        <Button
                          size="xs"
                          colorPalette="red"
                          variant="outline"
                          onClick={async () => {
                            if (!confirm(`Delete room ${r.roomNumber}?`)) return;
                            try {
                              await apiFetch(
                                `/pms/rooms/${r.id}?branchId=${branchId}`,
                                { method: "DELETE", tenant },
                              );
                              load();
                            } catch (e) {
                              appToast.error(e instanceof Error ? e.message : "Cannot delete room");
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
          {rooms.length === 0 && <EmptyState message="No rooms for this branch." />}
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
          <Box bg="white" p={6} borderRadius="md" minW="320px">
            <Text fontWeight="semibold" mb={3}>
              Edit room
            </Text>
            <Flex gap={2} direction="column" mb={3}>
              <Input
                size="sm"
                placeholder="Room #"
                value={editForm.roomNumber}
                onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value })}
              />
              <AppSelect
                items={[
                  { value: "", label: "Room type" },
                  ...roomTypes.map((rt) => ({ value: rt.id, label: rt.name })),
                ]}
                value={editForm.roomTypeId}
                onValueChange={(v) => setEditForm({ ...editForm, roomTypeId: v })}
                placeholder="Room type"
              />
              <Input
                size="sm"
                type="number"
                placeholder="Price/night"
                value={editForm.basePrice}
                onChange={(e) => setEditForm({ ...editForm, basePrice: e.target.value })}
              />
            </Flex>
            <Flex gap={2}>
              <Button size="sm" colorPalette="green" onClick={saveEdit}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditId(null)}>
                Cancel
              </Button>
            </Flex>
          </Box>
        </Box>
      )}
    </Box>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Input, Stack, Table, Text } from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import { BranchRequiredNotice } from "@/components/branch-required-notice";
import { FormDrawer } from "@/components/form-drawer";
import {
  ContentCard,
  EmptyState,
  FormField,
  StatusBadge,
  TableScrollArea,
  TableSkeleton,
} from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { Room, RoomType } from "@/lib/pms-types";
import { getSocket, joinBranch } from "@/lib/socket";
import { appToast } from "@/lib/app-toast";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";

const HOUSEKEEPING: Record<string, string[]> = {
  DIRTY: ["VACANT"],
  VACANT: ["MAINTENANCE"],
  MAINTENANCE: ["VACANT"],
};

export function RoomsTab({
  tenant,
  active = true,
}: {
  tenant: TenantHeaders;
  /** When false, skip fetch until the Rooms tab is selected (avoids stale status). */
  active?: boolean;
}) {
  const { ask, dialog } = useConfirmDialog();
  const branchId = tenant.branchId;
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const [form, setForm] = useState({
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
    if (active) load();
  }, [active, load]);

  useEffect(() => {
    if (!branchId) return;
    joinBranch(branchId);
    const socket = getSocket();
    if (!socket) return;
    const onStatus = ({ roomId, status }: { roomId: string; status: string }) => {
      setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, status } : r)));
    };
    socket.on("room.status", onStatus);
    return () => {
      socket.off("room.status", onStatus);
    };
  }, [branchId]);

  const openCreate = () => {
    setEditRoomId(null);
    setForm({ roomNumber: "", roomTypeId: "", basePrice: "" });
    setDrawerMode("create");
  };

  const openEdit = (room: Room) => {
    setEditRoomId(room.id);
    setForm({
      roomNumber: room.roomNumber,
      roomTypeId: roomTypes.find((rt) => rt.name === room.roomType.name)?.id ?? "",
      basePrice: String(room.basePrice),
    });
    setDrawerMode("edit");
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    setEditRoomId(null);
    setForm({ roomNumber: "", roomTypeId: "", basePrice: "" });
  };

  const saveRoom = async () => {
    if (!branchId || !form.roomNumber || !form.roomTypeId) return;
    try {
      if (drawerMode === "create") {
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
      } else if (editRoomId) {
        await apiFetch(`/pms/rooms/${editRoomId}?branchId=${branchId}`, {
          method: "PATCH",
          tenant,
          body: JSON.stringify({
            roomNumber: form.roomNumber,
            roomTypeId: form.roomTypeId,
            basePrice: Number(form.basePrice),
          }),
        });
      }
      closeDrawer();
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to save room");
    }
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

  const doRemove = async (roomId: string) => {
    if (!branchId) return;
    try {
      await apiFetch(`/pms/rooms/${roomId}?branchId=${branchId}`, {
        method: "DELETE",
        tenant,
      });
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Cannot delete room");
    }
  };

  const confirmRemove = (room: Room) => {
    ask({
      title: "Delete room?",
      description: `Room ${room.roomNumber} will be removed permanently.`,
      confirmLabel: "Delete",
      onConfirm: () => doRemove(room.id),
    });
  };

  if (!branchId) {
    return <BranchRequiredNotice />;
  }

  return (
    <>
      {dialog}
      <Flex gap={2} mb={4} wrap="wrap">
        <Button size="sm" onClick={load}>
          Refresh
        </Button>
        <Button size="sm" colorPalette="blue" w={{ base: "full", sm: "auto" }} onClick={openCreate}>
          + Add room
        </Button>
      </Flex>

      <Text fontSize="xs" color="fg.muted" mb={3}>
        Housekeeping: DIRTY → Clean (VACANT), VACANT ↔ MAINTENANCE. OCCUPIED is set by
        check-in/out only.
      </Text>

      <ContentCard p={0} overflow="hidden">
        {loading ? (
          <Box p={4}>
            <TableSkeleton rows={5} columns={6} />
          </Box>
        ) : (
          <>
            <TableScrollArea>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Room #</Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: "none", sm: "table-cell" }}>
                      Type
                    </Table.ColumnHeader>
                    <Table.ColumnHeader>Price</Table.ColumnHeader>
                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: "none", md: "table-cell" }}>
                      Housekeeping
                    </Table.ColumnHeader>
                    <Table.ColumnHeader>Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {rooms.map((r) => (
                    <Table.Row key={r.id}>
                      <Table.Cell fontWeight="medium">{r.roomNumber}</Table.Cell>
                      <Table.Cell display={{ base: "none", sm: "table-cell" }}>
                        {r.roomType.name}
                      </Table.Cell>
                      <Table.Cell>৳{Number(r.basePrice).toLocaleString()}</Table.Cell>
                      <Table.Cell>
                        <StatusBadge status={r.status} />
                      </Table.Cell>
                      <Table.Cell display={{ base: "none", md: "table-cell" }}>
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
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex gap={1} wrap="wrap">
                          {r.status !== "OCCUPIED" && (
                            <>
                              <Button size="xs" variant="outline" onClick={() => openEdit(r)}>
                                Edit
                              </Button>
                              <Button
                                size="xs"
                                colorPalette="red"
                                variant="outline"
                                onClick={() => confirmRemove(r)}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                          <Box display={{ md: "none" }} width="100%">
                            <Flex gap={1} wrap="wrap" mt={r.status !== "OCCUPIED" ? 1 : 0}>
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
                            </Flex>
                          </Box>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </TableScrollArea>
            {rooms.length === 0 && (
              <Box p={4}>
                <EmptyState message="No rooms for this branch." />
              </Box>
            )}
          </>
        )}
      </ContentCard>

      <FormDrawer
        open={drawerMode !== null}
        onClose={closeDrawer}
        title={drawerMode === "edit" ? "Edit room" : "Add room"}
        size="sm"
        primaryLabel={drawerMode === "edit" ? "Save" : "Create"}
        onPrimary={saveRoom}
        primaryDisabled={!form.roomNumber || !form.roomTypeId}
      >
        <Stack gap={4} width="100%">
          <FormField label="Room number" required>
            <Input
              size="sm"
              width="100%"
              placeholder="Room #"
              value={form.roomNumber}
              onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
            />
          </FormField>
          <FormField label="Room type" required>
            <AppSelect
              width="100%"
              items={[
                { value: "", label: "Room type" },
                ...roomTypes.map((rt) => ({ value: rt.id, label: rt.name })),
              ]}
              value={form.roomTypeId}
              onValueChange={(v) => setForm({ ...form, roomTypeId: v })}
              placeholder="Room type"
            />
          </FormField>
          <FormField label="Price per night" help="Base rate for this room.">
            <Input
              size="sm"
              width="100%"
              type="number"
              placeholder="Price/night"
              value={form.basePrice}
              onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
            />
          </FormField>
        </Stack>
      </FormDrawer>
    </>
  );
}

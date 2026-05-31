"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Input, Table, Text } from "@chakra-ui/react";
import { EmptyState, FormField, TableSkeleton } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { RoomType } from "@/lib/pms-types";
import { appToast } from "@/lib/app-toast";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";

export function RoomTypesTab({ tenant }: { tenant: TenantHeaders }) {
  const { ask, dialog } = useConfirmDialog();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", maxAdults: 2, maxChildren: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenant.organizationId) return;
    setLoading(true);
    try {
      setRoomTypes(await apiFetch<RoomType[]>("/pms/room-types", { tenant }));
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load room types");
    } finally {
      setLoading(false);
    }
  }, [tenant.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.name.trim()) return;
    const body = {
      name: form.name,
      maxAdults: form.maxAdults,
      maxChildren: form.maxChildren,
    };
    if (editingId) {
      await apiFetch(`/pms/room-types/${editingId}`, {
        method: "PATCH",
        tenant,
        body: JSON.stringify(body),
      });
    } else {
      await apiFetch("/pms/room-types", { method: "POST", tenant, body: JSON.stringify(body) });
    }
    setForm({ name: "", maxAdults: 2, maxChildren: 0 });
    setEditingId(null);
    load();
  };

  const doRemove = async (id: string) => {
    try {
      await apiFetch(`/pms/room-types/${id}`, { method: "DELETE", tenant });
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Cannot delete room type");
    }
  };

  const confirmRemove = (rt: RoomType) => {
    ask({
      title: "Delete room type?",
      description: `"${rt.name}" will be removed. Room types in use cannot be deleted.`,
      confirmLabel: "Delete",
      onConfirm: () => doRemove(rt.id),
    });
  };

  return (
    <>
      {dialog}
      <Box>
        <Box bg="white" borderRadius="md" p={4} mb={4}>
          <Text fontWeight="semibold" mb={3}>
            {editingId ? "Edit room type" : "New room type"}
          </Text>
          <Flex gap={2} wrap="wrap" mb={3}>
            <FormField label="Name" required>
              <Input
                size="sm"
                w="200px"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>
            <FormField label="Max adults">
              <Input
                size="sm"
                w="80px"
                type="number"
                placeholder="Adults"
                value={form.maxAdults}
                onChange={(e) => setForm({ ...form, maxAdults: Number(e.target.value) || 1 })}
              />
            </FormField>
            <FormField label="Max children">
              <Input
                size="sm"
                w="80px"
                type="number"
                placeholder="Children"
                value={form.maxChildren}
                onChange={(e) => setForm({ ...form, maxChildren: Number(e.target.value) || 0 })}
              />
            </FormField>
          </Flex>
          <Button size="sm" colorPalette="green" onClick={save}>
            {editingId ? "Update" : "Create"}
          </Button>
        </Box>
        <Box bg="white" borderRadius="md" p={4}>
          {loading ? (
            <TableSkeleton rows={5} columns={4} />
          ) : (
            <>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Name</Table.ColumnHeader>
                    <Table.ColumnHeader>Max adults</Table.ColumnHeader>
                    <Table.ColumnHeader>Max children</Table.ColumnHeader>
                    <Table.ColumnHeader>Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {roomTypes.map((rt) => (
                    <Table.Row key={rt.id}>
                      <Table.Cell>{rt.name}</Table.Cell>
                      <Table.Cell>{rt.maxAdults}</Table.Cell>
                      <Table.Cell>{rt.maxChildren}</Table.Cell>
                      <Table.Cell>
                        <Flex gap={1}>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => {
                              setEditingId(rt.id);
                              setForm({
                                name: rt.name,
                                maxAdults: rt.maxAdults,
                                maxChildren: rt.maxChildren,
                              });
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            colorPalette="red"
                            variant="outline"
                            onClick={() => confirmRemove(rt)}
                          >
                            Delete
                          </Button>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
              {roomTypes.length === 0 && (
                <EmptyState
                  title="No room types yet"
                  description="Define room types (e.g. Standard, Suite) before adding individual rooms."
                  icon="🛏️"
                />
              )}
            </>
          )}
        </Box>
      </Box>
    </>
  );
}

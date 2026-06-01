"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Input, SimpleGrid, Table } from "@chakra-ui/react";
import {
  ContentCard,
  EmptyState,
  FormField,
  TableScrollArea,
  TableSkeleton,
} from "@erp/ui";
import { FormDrawer } from "@/components/form-drawer";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { RoomType } from "@/lib/pms-types";
import { appToast } from "@/lib/app-toast";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";

export function RoomTypesTab({ tenant }: { tenant: TenantHeaders }) {
  const { ask, dialog } = useConfirmDialog();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", maxAdults: 2, maxChildren: 0 });

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

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", maxAdults: 2, maxChildren: 0 });
    setDrawerOpen(true);
  };

  const openEdit = (rt: RoomType) => {
    setEditingId(rt.id);
    setForm({ name: rt.name, maxAdults: rt.maxAdults, maxChildren: rt.maxChildren });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingId(null);
    setForm({ name: "", maxAdults: 2, maxChildren: 0 });
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const body = {
      name: form.name,
      maxAdults: form.maxAdults,
      maxChildren: form.maxChildren,
    };
    try {
      if (editingId) {
        await apiFetch(`/pms/room-types/${editingId}`, {
          method: "PATCH",
          tenant,
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/pms/room-types", { method: "POST", tenant, body: JSON.stringify(body) });
      }
      closeDrawer();
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to save room type");
    }
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
      <Flex gap={2} mb={4} wrap="wrap">
        <Button size="sm" onClick={load}>
          Refresh
        </Button>
        <Button size="sm" colorPalette="blue" w={{ base: "full", sm: "auto" }} onClick={openCreate}>
          + Add room type
        </Button>
      </Flex>

      <ContentCard p={0} overflow="hidden">
        {loading ? (
          <Box p={4}>
            <TableSkeleton rows={5} columns={4} />
          </Box>
        ) : (
          <>
            <TableScrollArea>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Name</Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: "none", sm: "table-cell" }}>
                      Max adults
                    </Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: "none", sm: "table-cell" }}>
                      Max children
                    </Table.ColumnHeader>
                    <Table.ColumnHeader>Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {roomTypes.map((rt) => (
                    <Table.Row key={rt.id}>
                      <Table.Cell>{rt.name}</Table.Cell>
                      <Table.Cell display={{ base: "none", sm: "table-cell" }}>
                        {rt.maxAdults}
                      </Table.Cell>
                      <Table.Cell display={{ base: "none", sm: "table-cell" }}>
                        {rt.maxChildren}
                      </Table.Cell>
                      <Table.Cell>
                        <Flex gap={1}>
                          <Button size="xs" variant="outline" onClick={() => openEdit(rt)}>
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
            </TableScrollArea>
            {roomTypes.length === 0 && (
              <Box p={4}>
                <EmptyState
                  title="No room types yet"
                  description="Define room types (e.g. Standard, Suite) before adding individual rooms."
                  icon="🛏️"
                />
              </Box>
            )}
          </>
        )}
      </ContentCard>

      <FormDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingId ? "Edit room type" : "New room type"}
        size="sm"
        primaryLabel={editingId ? "Update" : "Create"}
        onPrimary={save}
        primaryDisabled={!form.name.trim()}
      >
        <FormField label="Name" required>
          <Input
            size="sm"
            width="100%"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </FormField>
        <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4} width="100%">
          <FormField label="Max adults">
            <Input
              size="sm"
              width="100%"
              type="number"
              value={form.maxAdults}
              onChange={(e) => setForm({ ...form, maxAdults: Number(e.target.value) || 1 })}
            />
          </FormField>
          <FormField label="Max children">
            <Input
              size="sm"
              width="100%"
              type="number"
              value={form.maxChildren}
              onChange={(e) => setForm({ ...form, maxChildren: Number(e.target.value) || 0 })}
            />
          </FormField>
        </SimpleGrid>
      </FormDrawer>
    </>
  );
}

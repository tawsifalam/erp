"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Input, Table } from "@chakra-ui/react";
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
import type { Guest } from "@/lib/pms-types";
import { appToast } from "@/lib/app-toast";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";

export function GuestsTab({ tenant }: { tenant: TenantHeaders }) {
  const { ask, dialog } = useConfirmDialog();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "" });

  const load = useCallback(async () => {
    if (!tenant.organizationId) return;
    setLoading(true);
    try {
      const data = await apiFetch<Guest[]>("/pms/guests", { tenant });
      setGuests(data);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load guests");
    } finally {
      setLoading(false);
    }
  }, [tenant.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ fullName: "", phone: "", email: "" });
    setDrawerOpen(true);
  };

  const openEdit = (g: Guest) => {
    setEditingId(g.id);
    setForm({
      fullName: g.fullName,
      phone: g.phone ?? "",
      email: g.email ?? "",
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingId(null);
    setForm({ fullName: "", phone: "", email: "" });
  };

  const save = async () => {
    if (!form.fullName.trim()) return;
    const body = {
      fullName: form.fullName,
      phone: form.phone || undefined,
      email: form.email || undefined,
    };
    try {
      if (editingId) {
        await apiFetch(`/pms/guests/${editingId}`, {
          method: "PATCH",
          tenant,
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/pms/guests", { method: "POST", tenant, body: JSON.stringify(body) });
      }
      closeDrawer();
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to save guest");
    }
  };

  const doRemove = async (id: string) => {
    try {
      await apiFetch(`/pms/guests/${id}`, { method: "DELETE", tenant });
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Cannot delete guest");
    }
  };

  const confirmRemove = (guest: Guest) => {
    ask({
      title: "Delete guest?",
      description: `${guest.fullName} will be removed. Guests with reservations cannot be deleted.`,
      confirmLabel: "Delete",
      onConfirm: () => doRemove(guest.id),
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
          + Add guest
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
                      Phone
                    </Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: "none", md: "table-cell" }}>
                      Email
                    </Table.ColumnHeader>
                    <Table.ColumnHeader>Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {guests.map((g) => (
                    <Table.Row key={g.id}>
                      <Table.Cell>{g.fullName}</Table.Cell>
                      <Table.Cell display={{ base: "none", sm: "table-cell" }}>
                        {g.phone ?? "—"}
                      </Table.Cell>
                      <Table.Cell display={{ base: "none", md: "table-cell" }}>
                        {g.email ?? "—"}
                      </Table.Cell>
                      <Table.Cell>
                        <Flex gap={1}>
                          <Button size="xs" variant="outline" onClick={() => openEdit(g)}>
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            colorPalette="red"
                            variant="outline"
                            onClick={() => confirmRemove(g)}
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
            {guests.length === 0 && (
              <Box p={4}>
                <EmptyState title="No guests yet" description="Add guests to use in reservations." />
              </Box>
            )}
          </>
        )}
      </ContentCard>

      <FormDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingId ? "Edit guest" : "New guest"}
        size="sm"
        primaryLabel={editingId ? "Update" : "Create"}
        onPrimary={save}
        primaryDisabled={!form.fullName.trim()}
      >
        <FormField label="Full name" help="Guest name as shown on reservations." required>
          <Input
            size="sm"
            width="100%"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </FormField>
        <FormField label="Phone" help="Optional contact number.">
          <Input
            size="sm"
            width="100%"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </FormField>
        <FormField label="Email" help="Optional — used for confirmations.">
          <Input
            size="sm"
            width="100%"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </FormField>
      </FormDrawer>
    </>
  );
}

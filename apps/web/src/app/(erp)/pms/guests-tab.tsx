"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Input, Stack, Table, Text } from "@chakra-ui/react";
import { EmptyState, LoadingState } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { Guest } from "@/lib/pms-types";

export function GuestsTab({ tenant }: { tenant: TenantHeaders }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenant.organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Guest[]>("/pms/guests", { tenant });
      setGuests(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load guests");
    } finally {
      setLoading(false);
    }
  }, [tenant.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.fullName.trim()) return;
    const body = {
      fullName: form.fullName,
      phone: form.phone || undefined,
      email: form.email || undefined,
    };
    if (editingId) {
      await apiFetch(`/pms/guests/${editingId}`, {
        method: "PATCH",
        tenant,
        body: JSON.stringify(body),
      });
    } else {
      await apiFetch("/pms/guests", { method: "POST", tenant, body: JSON.stringify(body) });
    }
    setForm({ fullName: "", phone: "", email: "" });
    setEditingId(null);
    load();
  };

  const startEdit = (g: Guest) => {
    setEditingId(g.id);
    setForm({
      fullName: g.fullName,
      phone: g.phone ?? "",
      email: g.email ?? "",
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this guest?")) return;
    try {
      await apiFetch(`/pms/guests/${id}`, { method: "DELETE", tenant });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot delete guest");
    }
  };

  return (
    <Box>
      {error && (
        <Text color="red.500" mb={3} fontSize="sm">
          {error}
        </Text>
      )}
      <Box bg="white" borderRadius="md" p={4} mb={4}>
        <Text fontWeight="semibold" mb={3}>
          {editingId ? "Edit guest" : "New guest"}
        </Text>
        <Stack gap={3}>
          <Flex gap={2} wrap="wrap">
            <Input
              size="sm"
              w="200px"
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
            <Input
              size="sm"
              w="160px"
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              size="sm"
              w="200px"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Flex>
          <Flex gap={2}>
            <Button size="sm" colorPalette="green" onClick={save}>
              {editingId ? "Update" : "Create"}
            </Button>
            {editingId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm({ fullName: "", phone: "", email: "" });
                }}
              >
                Cancel
              </Button>
            )}
          </Flex>
        </Stack>
      </Box>
      {loading && <LoadingState />}
      {!loading && (
        <Box bg="white" borderRadius="md" p={4}>
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Name</Table.ColumnHeader>
                <Table.ColumnHeader>Phone</Table.ColumnHeader>
                <Table.ColumnHeader>Email</Table.ColumnHeader>
                <Table.ColumnHeader>Actions</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {guests.map((g) => (
                <Table.Row key={g.id}>
                  <Table.Cell>{g.fullName}</Table.Cell>
                  <Table.Cell>{g.phone ?? "—"}</Table.Cell>
                  <Table.Cell>{g.email ?? "—"}</Table.Cell>
                  <Table.Cell>
                    <Flex gap={1}>
                      <Button size="xs" variant="outline" onClick={() => startEdit(g)}>
                        Edit
                      </Button>
                      <Button size="xs" colorPalette="red" variant="outline" onClick={() => remove(g.id)}>
                        Delete
                      </Button>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          {guests.length === 0 && <EmptyState message="No guests yet." />}
        </Box>
      )}
    </Box>
  );
}

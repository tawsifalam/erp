"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Input, Table, Text } from "@chakra-ui/react";
import { EmptyState, LoadingState } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { RoomType } from "@/lib/pms-types";

export function RoomTypesTab({ tenant }: { tenant: TenantHeaders }) {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", maxAdults: 2, maxChildren: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenant.organizationId) return;
    setLoading(true);
    setError(null);
    try {
      setRoomTypes(await apiFetch<RoomType[]>("/pms/room-types", { tenant }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load room types");
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

  return (
    <Box>
      {error && (
        <Text color="red.500" mb={3} fontSize="sm">
          {error}
        </Text>
      )}
      <Box bg="white" borderRadius="md" p={4} mb={4}>
        <Text fontWeight="semibold" mb={3}>
          {editingId ? "Edit room type" : "New room type"}
        </Text>
        <Flex gap={2} wrap="wrap" mb={3}>
          <Input
            size="sm"
            w="200px"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            size="sm"
            w="80px"
            type="number"
            placeholder="Adults"
            value={form.maxAdults}
            onChange={(e) => setForm({ ...form, maxAdults: Number(e.target.value) || 1 })}
          />
          <Input
            size="sm"
            w="80px"
            type="number"
            placeholder="Children"
            value={form.maxChildren}
            onChange={(e) => setForm({ ...form, maxChildren: Number(e.target.value) || 0 })}
          />
        </Flex>
        <Button size="sm" colorPalette="green" onClick={save}>
          {editingId ? "Update" : "Create"}
        </Button>
      </Box>
      {loading && <LoadingState />}
      {!loading && (
        <Box bg="white" borderRadius="md" p={4}>
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
                        onClick={async () => {
                          if (!confirm(`Delete room type "${rt.name}"?`)) return;
                          try {
                            await apiFetch(`/pms/room-types/${rt.id}`, {
                              method: "DELETE",
                              tenant,
                            });
                            load();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "Cannot delete room type");
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          {roomTypes.length === 0 && <EmptyState message="No room types. Create one before adding rooms." />}
        </Box>
      )}
    </Box>
  );
}

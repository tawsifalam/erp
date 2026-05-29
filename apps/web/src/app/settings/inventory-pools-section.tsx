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
import { EmptyState, LoadingState } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";

type InventoryPool = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
};

export function InventoryPoolsSection({
  tenant,
  onMessage,
  onError,
}: {
  tenant: TenantHeaders | undefined;
  onMessage: (msg: string) => void;
  onError?: (msg: string | null) => void;
}) {
  const [pools, setPools] = useState<InventoryPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", name: "" });

  const load = useCallback(async () => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<InventoryPool[]>("/inventory/pools", { tenant });
      setPools(data);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Failed to load pools");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    load();
  }, [load]);

  const createPool = async () => {
    if (!tenant) return;
    onError?.(null);
    try {
      await apiFetch("/inventory/pools", {
        method: "POST",
        tenant,
        body: JSON.stringify(form),
      });
      setForm({ code: "", name: "" });
      setShowForm(false);
      onMessage("Inventory pool created");
      load();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Failed to create pool");
    }
  };

  const updatePool = async (id: string, data: Partial<InventoryPool>) => {
    if (!tenant) return;
    onError?.(null);
    try {
      await apiFetch(`/inventory/pools/${id}`, {
        method: "PATCH",
        tenant,
        body: JSON.stringify(data),
      });
      onMessage("Inventory pool updated");
      load();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Failed to update pool");
    }
  };

  if (!tenant) return null;

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={3}>
        <Box>
          <Text fontWeight="semibold">Inventory pools</Text>
          <Text fontSize="sm" color="fg.muted">
            Separate stock for guest kitchen, staff pantry, and custom pools. Pool codes are text
            slugs (e.g. minibar).
          </Text>
        </Box>
        <Button size="sm" colorPalette="blue" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add pool"}
        </Button>
      </Flex>

      {showForm && (
        <Box bg="white" borderRadius="md" p={4} mb={4}>
          <Stack gap={3} maxW="480px">
            <Input
              size="sm"
              placeholder="Code (e.g. minibar)"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <Input
              size="sm"
              placeholder="Display name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Button size="sm" colorPalette="green" w="fit-content" onClick={createPool}>
              Create pool
            </Button>
          </Stack>
        </Box>
      )}

      {loading && <LoadingState label="Loading pools…" />}
      <Box bg="white" borderRadius="md" p={4}>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Code</Table.ColumnHeader>
              <Table.ColumnHeader>Name</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
              <Table.ColumnHeader>Actions</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {pools.map((p) => (
              <PoolRow key={p.id} pool={p} onSave={updatePool} />
            ))}
          </Table.Body>
        </Table.Root>
        {!loading && pools.length === 0 && (
          <EmptyState message="No inventory pools. They are created automatically for new organizations." />
        )}
      </Box>
    </Box>
  );
}

function PoolRow({
  pool,
  onSave,
}: {
  pool: InventoryPool;
  onSave: (id: string, data: Partial<InventoryPool>) => void;
}) {
  const [name, setName] = useState(pool.name);

  useEffect(() => {
    setName(pool.name);
  }, [pool.name]);

  return (
    <Table.Row>
      <Table.Cell fontFamily="mono" fontSize="xs">
        {pool.code}
        {pool.isSystem && (
          <Text as="span" fontSize="xs" color="fg.muted" ml={1}>
            (system)
          </Text>
        )}
      </Table.Cell>
      <Table.Cell>
        <Input
          size="sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Table.Cell>
      <Table.Cell>{pool.isActive ? "Active" : "Inactive"}</Table.Cell>
      <Table.Cell>
        <Flex gap={2}>
          <Button size="xs" variant="outline" onClick={() => onSave(pool.id, { name })}>
            Save
          </Button>
          {!pool.isSystem && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => onSave(pool.id, { isActive: !pool.isActive })}
            >
              {pool.isActive ? "Deactivate" : "Activate"}
            </Button>
          )}
        </Flex>
      </Table.Cell>
    </Table.Row>
  );
}

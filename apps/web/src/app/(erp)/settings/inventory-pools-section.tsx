"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Flex,
  Input,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { ContentCard, EmptyState, FormField, TableSkeleton, TableScrollArea } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import { appToast } from "@/lib/app-toast";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";

type InventoryPool = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
};

export function InventoryPoolsSection({ tenant }: { tenant: TenantHeaders | undefined }) {
  const { ask, dialog } = useConfirmDialog();
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
      appToast.error(e instanceof Error ? e.message : "Failed to load pools");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    load();
  }, [load]);

  const createPool = async () => {
    if (!tenant) return;
    try {
      await apiFetch("/inventory/pools", {
        method: "POST",
        tenant,
        body: JSON.stringify(form),
      });
      setForm({ code: "", name: "" });
      setShowForm(false);
      appToast.success("Inventory pool created");
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to create pool");
    }
  };

  const updatePool = async (id: string, data: Partial<InventoryPool>) => {
    if (!tenant) return;
    try {
      await apiFetch(`/inventory/pools/${id}`, {
        method: "PATCH",
        tenant,
        body: JSON.stringify(data),
      });
      appToast.success("Inventory pool updated");
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to update pool");
    }
  };

  const confirmToggleActive = (pool: InventoryPool) => {
    if (pool.isActive) {
      ask({
        title: `Deactivate pool "${pool.code}"?`,
        description: "Items in this pool will no longer appear in branch filters.",
        confirmLabel: "Deactivate",
        onConfirm: () => updatePool(pool.id, { isActive: false }),
      });
    } else {
      updatePool(pool.id, { isActive: true });
    }
  };

  if (!tenant) return null;

  return (
    <>
      {dialog}
      <Flex justify="space-between" align="center" mb={3}>
        <Text fontWeight="semibold">Inventory pools</Text>
        <Button size="sm" colorPalette="blue" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add pool"}
        </Button>
      </Flex>
      <Text fontSize="sm" color="fg.muted" mb={3}>
        Separate stock for guest kitchen, staff pantry, housekeeping (amenity kits), and custom
        pools. Pool codes are text slugs (e.g. minibar). System pools are added automatically when
        missing.
      </Text>

      {showForm && (
        <ContentCard mb={4}>
          <Stack gap={3} maxW={{ base: "full", md: "480px" }}>
            <FormField label="Code" help="Text slug (e.g. minibar). Cannot be changed later.">
              <Input
                size="sm"
                placeholder="Code (e.g. minibar)"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </FormField>
            <FormField label="Display name">
              <Input
                size="sm"
                placeholder="Display name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>
            <Button size="sm" colorPalette="green" w="fit-content" onClick={createPool}>
              Create pool
            </Button>
          </Stack>
        </ContentCard>
      )}

      <ContentCard>
        {loading ? (
          <TableSkeleton rows={4} columns={4} />
        ) : (
          <>
            <TableScrollArea>
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
                    <PoolRow
                      key={p.id}
                      pool={p}
                      onSave={updatePool}
                      onToggleActive={confirmToggleActive}
                    />
                  ))}
                </Table.Body>
              </Table.Root>
            </TableScrollArea>
            {pools.length === 0 && (
              <EmptyState
                title="No inventory pools"
                description="Guest and staff default pools are created automatically for new organizations. Add custom pools for minibar, pantry, or other stock."
              />
            )}
          </>
        )}
      </ContentCard>
    </>
  );
}

function PoolRow({
  pool,
  onSave,
  onToggleActive,
}: {
  pool: InventoryPool;
  onSave: (id: string, data: Partial<InventoryPool>) => void;
  onToggleActive: (pool: InventoryPool) => void;
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
        <Input size="sm" value={name} onChange={(e) => setName(e.target.value)} />
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
              onClick={() => onToggleActive(pool)}
            >
              {pool.isActive ? "Deactivate" : "Activate"}
            </Button>
          )}
        </Flex>
      </Table.Cell>
    </Table.Row>
  );
}

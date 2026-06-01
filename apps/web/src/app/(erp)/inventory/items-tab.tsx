"use client";

import { useEffect, useState, useCallback } from "react";
import { Box, Button, Flex, Input, Stack, Table, Text } from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import { BranchRequiredNotice } from "@/components/branch-required-notice";
import { FormDrawer } from "@/components/form-drawer";
import {
  ContentCard,
  EmptyState,
  FormField,
  TableScrollArea,
  TableSkeleton,
} from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import { appToast } from "@/lib/app-toast";

type Item = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  currentStock: number;
  averageUnitCost?: string | number;
  lowStockThreshold?: string | null;
  pool?: { id: string; code: string; name: string };
};
type InventoryPool = { id: string; code: string; name: string };
type Movement = {
  id: string;
  direction: string;
  movementType: string;
  quantity: string;
  notes?: string;
  createdAt: string;
};

const emptyItemForm = (poolId = "") => ({
  name: "",
  sku: "",
  unit: "",
  lowStockThreshold: "",
  poolId,
});

const emptyMovForm = () => ({
  itemId: "",
  movementType: "PURCHASE",
  adjustmentDirection: "IN",
  quantity: "",
  unitCost: "",
  notes: "",
});

export function InventoryItemsTab({ tenant }: { tenant: TenantHeaders }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [pools, setPools] = useState<InventoryPool[]>([]);
  const [poolFilter, setPoolFilter] = useState("");

  const [createDrawer, setCreateDrawer] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItemForm());

  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [editForm, setEditForm] = useState({ name: "", unit: "", lowStockThreshold: "" });
  const [detailLoading, setDetailLoading] = useState(false);

  const [movementDrawer, setMovementDrawer] = useState(false);
  const [movForm, setMovForm] = useState(emptyMovForm());

  const load = useCallback(async () => {
    if (!tenant.branchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const poolQuery = poolFilter ? `&pool=${poolFilter}` : "";
    try {
      const [itemData, poolData] = await Promise.all([
        apiFetch<Item[]>(`/inventory/items?branchId=${tenant.branchId}${poolQuery}`, { tenant }),
        apiFetch<InventoryPool[]>("/inventory/pools?activeOnly=true", { tenant }),
      ]);
      setItems(itemData);
      setPools(poolData);
      const defaultPool =
        poolData.find((p) => p.code === "guest")?.id ?? poolData[0]?.id ?? "";
      setItemForm((f) => (f.poolId ? f : { ...f, poolId: defaultPool }));
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load items");
    } finally {
      setLoading(false);
    }
  }, [tenant.branchId, tenant.organizationId, poolFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    const defaultPool =
      pools.find((p) => p.code === "guest")?.id ?? pools[0]?.id ?? "";
    setItemForm(emptyItemForm(defaultPool));
    setCreateDrawer(true);
  };

  const closeCreate = () => {
    setCreateDrawer(false);
    setItemForm(emptyItemForm(pools.find((p) => p.code === "guest")?.id ?? pools[0]?.id ?? ""));
  };

  const handleCreateItem = async () => {
    try {
      await apiFetch("/inventory/items", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          branchId: tenant.branchId,
          poolId: itemForm.poolId || undefined,
          name: itemForm.name,
          sku: itemForm.sku,
          unit: itemForm.unit,
          lowStockThreshold: itemForm.lowStockThreshold
            ? Number(itemForm.lowStockThreshold)
            : undefined,
        }),
      });
      closeCreate();
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to create item");
    }
  };

  const openDetail = async (item: Item) => {
    setDetailItemId(item.id);
    setEditForm({
      name: item.name,
      unit: item.unit,
      lowStockThreshold: item.lowStockThreshold ?? "",
    });
    setDetailLoading(true);
    try {
      const data = await apiFetch<Movement[]>(
        `/inventory/items/${item.id}/movements?branchId=${tenant.branchId}`,
        { tenant },
      );
      setMovements(data);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load movements");
      setMovements([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailItemId(null);
    setMovements([]);
  };

  const handleUpdateItem = async () => {
    if (!detailItemId) return;
    try {
      await apiFetch(`/inventory/items/${detailItemId}?branchId=${tenant.branchId}`, {
        method: "PATCH",
        tenant,
        body: JSON.stringify({
          name: editForm.name,
          unit: editForm.unit,
          lowStockThreshold: editForm.lowStockThreshold
            ? Number(editForm.lowStockThreshold)
            : null,
        }),
      });
      load();
      const item = items.find((i) => i.id === detailItemId);
      if (item) await openDetail({ ...item, ...editForm });
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to update item");
    }
  };

  const openMovement = () => {
    setMovForm(emptyMovForm());
    setMovementDrawer(true);
  };

  const handleAddMovement = async () => {
    try {
      const body: Record<string, unknown> = {
        itemId: movForm.itemId,
        branchId: tenant.branchId,
        movementType: movForm.movementType,
        quantity: Number(movForm.quantity),
        notes: movForm.notes || undefined,
      };
      if (movForm.movementType === "ADJUSTMENT") {
        body.direction = movForm.adjustmentDirection;
      }
      if (
        (movForm.movementType === "PURCHASE" ||
          (movForm.movementType === "ADJUSTMENT" && movForm.adjustmentDirection === "IN")) &&
        movForm.unitCost
      ) {
        body.unitCost = Number(movForm.unitCost);
      }
      await apiFetch("/inventory/movements", {
        method: "POST",
        tenant,
        body: JSON.stringify(body),
      });
      setMovementDrawer(false);
      setMovForm(emptyMovForm());
      load();
      if (detailItemId) {
        const item = items.find((i) => i.id === detailItemId);
        if (item) await openDetail(item);
      }
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to record movement");
    }
  };

  const detailItem = items.find((i) => i.id === detailItemId);

  if (!tenant.branchId) {
    return <BranchRequiredNotice />;
  }

  return (
    <>
      <Flex gap={2} mb={4} wrap="wrap" align="center">
        <Button size="sm" onClick={load}>
          Refresh
        </Button>
        <AppSelect
          width="200px"
          items={[
            { value: "", label: "All pools" },
            ...pools.map((p) => ({ value: p.code, label: p.name })),
          ]}
          value={poolFilter}
          onValueChange={setPoolFilter}
          placeholder="All pools"
        />
        <Button
          size="sm"
          colorPalette="blue"
          w={{ base: "full", sm: "auto" }}
          onClick={openCreate}
        >
          + New item
        </Button>
        <Button
          size="sm"
          variant="outline"
          w={{ base: "full", sm: "auto" }}
          onClick={openMovement}
        >
          + Record movement
        </Button>
      </Flex>

      <ContentCard p={0} overflow="hidden">
        {loading ? (
          <Box p={4}>
            <TableSkeleton rows={6} columns={6} />
          </Box>
        ) : (
          <>
            <TableScrollArea>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader display={{ base: "none", sm: "table-cell" }}>
                      SKU
                    </Table.ColumnHeader>
                    <Table.ColumnHeader>Name</Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: "none", md: "table-cell" }}>
                      Pool
                    </Table.ColumnHeader>
                    <Table.ColumnHeader>On hand</Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: "none", sm: "table-cell" }}>
                      Unit
                    </Table.ColumnHeader>
                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                    <Table.ColumnHeader />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {items.map((i) => {
                    const isLow =
                      i.lowStockThreshold != null &&
                      i.currentStock <= Number(i.lowStockThreshold);
                    return (
                      <Table.Row key={i.id}>
                        <Table.Cell
                          fontFamily="mono"
                          fontSize="xs"
                          display={{ base: "none", sm: "table-cell" }}
                        >
                          {i.sku}
                        </Table.Cell>
                        <Table.Cell>{i.name}</Table.Cell>
                        <Table.Cell
                          fontSize="xs"
                          color="fg.muted"
                          display={{ base: "none", md: "table-cell" }}
                        >
                          {i.pool?.name ?? "—"}
                        </Table.Cell>
                        <Table.Cell fontWeight="bold" color={isLow ? "red.500" : undefined}>
                          {i.currentStock.toFixed(2)}
                        </Table.Cell>
                        <Table.Cell display={{ base: "none", sm: "table-cell" }}>
                          {i.unit}
                        </Table.Cell>
                        <Table.Cell>
                          {isLow ? (
                            <Text color="red.500" fontSize="xs" fontWeight="bold">
                              LOW
                            </Text>
                          ) : (
                            <Text color="green.500" fontSize="xs">
                              OK
                            </Text>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <Button size="xs" variant="outline" onClick={() => openDetail(i)}>
                            View
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Root>
            </TableScrollArea>
            {items.length === 0 && (
              <Box p={4}>
                <EmptyState message="No inventory items yet." />
              </Box>
            )}
          </>
        )}
      </ContentCard>

      <FormDrawer
        open={createDrawer}
        onClose={closeCreate}
        title="New inventory item"
        size="sm"
        primaryLabel="Create"
        onPrimary={handleCreateItem}
        primaryDisabled={!itemForm.name.trim()}
      >
        <Stack gap={4} width="100%">
          <FormField label="Name" required>
            <Input
              size="sm"
              width="100%"
              placeholder="Name"
              value={itemForm.name}
              onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
            />
          </FormField>
          <FormField label="SKU">
            <Input
              size="sm"
              width="100%"
              placeholder="SKU"
              value={itemForm.sku}
              onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
            />
          </FormField>
          <FormField label="Unit">
            <Input
              size="sm"
              width="100%"
              placeholder="Unit"
              value={itemForm.unit}
              onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
            />
          </FormField>
          <FormField label="Low stock at" help="Alert when on-hand falls below this level.">
            <Input
              size="sm"
              width="100%"
              type="number"
              value={itemForm.lowStockThreshold}
              onChange={(e) =>
                setItemForm({ ...itemForm, lowStockThreshold: e.target.value })
              }
            />
          </FormField>
          <FormField label="Pool">
            <AppSelect
              width="100%"
              items={pools.map((p) => ({ value: p.id, label: p.name }))}
              value={itemForm.poolId}
              onValueChange={(v) => setItemForm({ ...itemForm, poolId: v })}
              placeholder="Pool"
            />
          </FormField>
        </Stack>
      </FormDrawer>

      <FormDrawer
        open={movementDrawer}
        onClose={() => setMovementDrawer(false)}
        title="Record movement"
        size="md"
        primaryLabel="Record"
        onPrimary={handleAddMovement}
        primaryDisabled={!movForm.itemId || !movForm.quantity}
      >
        <Stack gap={4} width="100%">
          <FormField label="Item" required>
            <AppSelect
              width="100%"
              items={[
                { value: "", label: "Select item" },
                ...items.map((i) => ({ value: i.id, label: `${i.name} (${i.sku})` })),
              ]}
              value={movForm.itemId}
              onValueChange={(v) => setMovForm({ ...movForm, itemId: v })}
              placeholder="Select item"
            />
          </FormField>
          <FormField label="Movement type">
            <AppSelect
              width="100%"
              items={[
                { value: "PURCHASE", label: "Purchase (IN)" },
                { value: "SALE", label: "Sale (OUT)" },
                { value: "WASTE", label: "Waste (OUT)" },
                { value: "STAFF_MEAL", label: "Staff Meal (OUT)" },
                { value: "ADJUSTMENT", label: "Adjustment" },
              ]}
              value={movForm.movementType}
              onValueChange={(v) => setMovForm({ ...movForm, movementType: v })}
            />
          </FormField>
          {movForm.movementType === "ADJUSTMENT" && (
            <FormField label="Direction">
              <AppSelect
                width="100%"
                items={[
                  { value: "IN", label: "Adjust IN" },
                  { value: "OUT", label: "Adjust OUT" },
                ]}
                value={movForm.adjustmentDirection}
                onValueChange={(v) => setMovForm({ ...movForm, adjustmentDirection: v })}
              />
            </FormField>
          )}
          <FormField label="Quantity" required>
            <Input
              size="sm"
              width="100%"
              type="number"
              value={movForm.quantity}
              onChange={(e) => setMovForm({ ...movForm, quantity: e.target.value })}
            />
          </FormField>
          {(movForm.movementType === "PURCHASE" ||
            (movForm.movementType === "ADJUSTMENT" && movForm.adjustmentDirection === "IN")) && (
            <FormField label="Unit cost" help="Updates weighted-average cost on inbound movements.">
              <Input
                size="sm"
                width="100%"
                type="number"
                value={movForm.unitCost}
                onChange={(e) => setMovForm({ ...movForm, unitCost: e.target.value })}
              />
            </FormField>
          )}
          <FormField label="Notes">
            <Input
              size="sm"
              width="100%"
              value={movForm.notes}
              onChange={(e) => setMovForm({ ...movForm, notes: e.target.value })}
            />
          </FormField>
        </Stack>
      </FormDrawer>

      <FormDrawer
        open={!!detailItemId}
        onClose={closeDetail}
        title={detailItem ? `${detailItem.name} (${detailItem.sku})` : "Item detail"}
        size="md"
        primaryLabel="Save changes"
        onPrimary={handleUpdateItem}
        primaryDisabled={!editForm.name.trim()}
      >
        <Stack gap={4}>
          <FormField label="Name" required>
            <Input
              size="sm"
              width="100%"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </FormField>
          <FormField label="Unit">
            <Input
              size="sm"
              width="100%"
              value={editForm.unit}
              onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
            />
          </FormField>
          <FormField label="Low stock threshold">
            <Input
              size="sm"
              width="100%"
              type="number"
              value={editForm.lowStockThreshold}
              onChange={(e) =>
                setEditForm({ ...editForm, lowStockThreshold: e.target.value })
              }
            />
          </FormField>
          {detailItem && (
            <Text fontSize="sm" color="fg.muted">
              Average unit cost: {Number(detailItem.averageUnitCost ?? 0).toFixed(4)}
            </Text>
          )}
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Recent movements
            </Text>
            {detailLoading ? (
              <Text fontSize="sm" color="fg.muted">
                Loading…
              </Text>
            ) : movements.length === 0 ? (
              <Text fontSize="sm" color="fg.muted">
                No movements recorded.
              </Text>
            ) : (
              <Stack gap={1}>
                {movements.slice(0, 20).map((m) => (
                  <Flex
                    key={m.id}
                    justify="space-between"
                    fontSize="sm"
                    borderBottomWidth="1px"
                    pb={1}
                  >
                    <Box>
                      <Text fontWeight="medium">
                        {m.direction === "IN" ? "+" : "−"}
                        {Number(m.quantity).toFixed(2)}
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        {m.movementType}
                      </Text>
                    </Box>
                    <Text fontSize="xs" color="fg.muted">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </Text>
                  </Flex>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </FormDrawer>
    </>
  );
}

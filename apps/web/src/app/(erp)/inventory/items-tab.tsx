"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Button,
  Table,
  Text,
  Input,
  Flex,
  Stack,
} from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import { BranchRequiredNotice } from "@/components/branch-required-notice";
import { EmptyState, FormField, TableSkeleton } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import { appToast } from "@/lib/app-toast";

type Item = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  currentStock: number;
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

export function InventoryItemsTab({ tenant }: { tenant: TenantHeaders }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [pools, setPools] = useState<InventoryPool[]>([]);
  const [poolFilter, setPoolFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    sku: "",
    unit: "",
    lowStockThreshold: "",
    poolId: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    unit: "",
    lowStockThreshold: "",
  });
  const [movForm, setMovForm] = useState({
    itemId: "",
    movementType: "PURCHASE",
    adjustmentDirection: "IN",
    quantity: "",
    notes: "",
  });

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
      setItemForm((f) =>
        f.poolId ? f : { ...f, poolId: poolData.find((p) => p.code === "guest")?.id ?? poolData[0]?.id ?? "" },
      );
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load items");
    } finally {
      setLoading(false);
    }
  }, [tenant.branchId, tenant.organizationId, poolFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMovements = async (itemId: string) => {
    setSelectedItem(itemId);
    const item = items.find((i) => i.id === itemId);
    if (item) {
      setEditingItem(item);
      setEditForm({
        name: item.name,
        unit: item.unit,
        lowStockThreshold: item.lowStockThreshold ?? "",
      });
    }
    const data = await apiFetch<Movement[]>(
      `/inventory/items/${itemId}/movements?branchId=${tenant.branchId}`,
      { tenant },
    );
    setMovements(data);
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
      setItemForm({
        name: "",
        sku: "",
        unit: "",
        lowStockThreshold: "",
        poolId: pools.find((p) => p.code === "guest")?.id ?? pools[0]?.id ?? "",
      });
      setShowItemForm(false);
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to create item");
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    try {
      await apiFetch(
        `/inventory/items/${editingItem.id}?branchId=${tenant.branchId}`,
        {
          method: "PATCH",
          tenant,
          body: JSON.stringify({
            name: editForm.name,
            unit: editForm.unit,
            lowStockThreshold: editForm.lowStockThreshold
              ? Number(editForm.lowStockThreshold)
              : null,
          }),
        },
      );
      load();
      if (selectedItem) loadMovements(selectedItem);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to update item");
    }
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
      await apiFetch("/inventory/movements", {
        method: "POST",
        tenant,
        body: JSON.stringify(body),
      });
      setMovForm({
        itemId: "",
        movementType: "PURCHASE",
        adjustmentDirection: "IN",
        quantity: "",
        notes: "",
      });
      setShowAdd(false);
      load();
      if (selectedItem) loadMovements(selectedItem);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to record movement");
    }
  };

  const selectedItemData = items.find((i) => i.id === selectedItem);

  if (!tenant.branchId) {
    return <BranchRequiredNotice />;
  }

  return (
    <Box>

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
        <Button size="sm" variant="outline" onClick={() => setShowItemForm(!showItemForm)}>
          {showItemForm ? "Cancel" : "+ New Item"}
        </Button>
        <Button size="sm" colorPalette="blue" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "+ Record Movement"}
        </Button>
      </Flex>

      {showItemForm && (
        <Box bg="white" borderRadius="md" p={4} mb={4}>
          <Stack gap={3}>
            <Flex gap={3} wrap="wrap">
              <FormField label="Name" required>
                <Input
                  size="sm"
                  w="180px"
                  placeholder="Name"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                />
              </FormField>
              <FormField label="SKU">
                <Input
                  size="sm"
                  w="120px"
                  placeholder="SKU"
                  value={itemForm.sku}
                  onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                />
              </FormField>
              <FormField label="Unit">
                <Input
                  size="sm"
                  w="100px"
                  placeholder="Unit"
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                />
              </FormField>
              <FormField label="Low stock at" help="Alert when on-hand falls below this level.">
                <Input
                  size="sm"
                  w="120px"
                  type="number"
                  placeholder="Low stock at"
                  value={itemForm.lowStockThreshold}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, lowStockThreshold: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Pool">
                <AppSelect
                  width="180px"
                  items={pools.map((p) => ({ value: p.id, label: p.name }))}
                  value={itemForm.poolId}
                  onValueChange={(v) => setItemForm({ ...itemForm, poolId: v })}
                  placeholder="Pool"
                />
              </FormField>
            </Flex>
            <Button size="sm" colorPalette="green" w="fit-content" onClick={handleCreateItem}>
              Create Item
            </Button>
          </Stack>
        </Box>
      )}

      {showAdd && (
        <Box bg="white" borderRadius="md" p={4} mb={4}>
          <Stack gap={3}>
            <Flex gap={3} wrap="wrap">
              <FormField label="Item" required>
                <AppSelect
                  width="200px"
                  items={[
                    { value: "", label: "Select Item" },
                    ...items.map((i) => ({ value: i.id, label: `${i.name} (${i.sku})` })),
                  ]}
                  value={movForm.itemId}
                  onValueChange={(v) => setMovForm({ ...movForm, itemId: v })}
                  placeholder="Select Item"
                />
              </FormField>
              <FormField label="Movement type">
                <AppSelect
                  width="160px"
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
                    width="120px"
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
                  w="100px"
                  type="number"
                  placeholder="Qty"
                  value={movForm.quantity}
                  onChange={(e) => setMovForm({ ...movForm, quantity: e.target.value })}
                />
              </FormField>
              <FormField label="Notes">
                <Input
                  size="sm"
                  w="200px"
                  placeholder="Notes (optional)"
                  value={movForm.notes}
                  onChange={(e) => setMovForm({ ...movForm, notes: e.target.value })}
                />
              </FormField>
            </Flex>
            <Button size="sm" colorPalette="green" w="fit-content" onClick={handleAddMovement}>
              Record Movement
            </Button>
          </Stack>
        </Box>
      )}

      <Flex gap={4} wrap="wrap">
        <Box flex="1" minW="400px" bg="white" borderRadius="md" p={4}>
          {loading ? (
            <TableSkeleton rows={6} columns={6} />
          ) : (
            <>
              <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>SKU</Table.ColumnHeader>
                <Table.ColumnHeader>Name</Table.ColumnHeader>
                <Table.ColumnHeader>Pool</Table.ColumnHeader>
                <Table.ColumnHeader>On Hand</Table.ColumnHeader>
                <Table.ColumnHeader>Unit</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {items.map((i) => {
                const isLow =
                  i.lowStockThreshold != null &&
                  i.currentStock <= Number(i.lowStockThreshold);
                return (
                  <Table.Row
                    key={i.id}
                    cursor="pointer"
                    bg={selectedItem === i.id ? "blue.50" : undefined}
                    onClick={() => loadMovements(i.id)}
                    _hover={{ bg: "gray.50" }}
                  >
                    <Table.Cell fontFamily="mono" fontSize="xs">
                      {i.sku}
                    </Table.Cell>
                    <Table.Cell>{i.name}</Table.Cell>
                    <Table.Cell fontSize="xs" color="fg.muted">
                      {i.pool?.name ?? "—"}
                    </Table.Cell>
                    <Table.Cell fontWeight="bold" color={isLow ? "red.500" : undefined}>
                      {i.currentStock.toFixed(2)}
                    </Table.Cell>
                    <Table.Cell>{i.unit}</Table.Cell>
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
                  </Table.Row>
                );
              })}
            </Table.Body>
              </Table.Root>
              {items.length === 0 && <EmptyState message="No inventory items yet." />}
            </>
          )}
        </Box>

        {selectedItem && editingItem && (
          <Box w="350px" bg="white" borderRadius="md" p={4}>
            <Text fontWeight="semibold" mb={2}>
              Edit: {selectedItemData?.sku}
            </Text>
            <Stack gap={2} mb={4}>
              <Input
                size="sm"
                placeholder="Name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
              <Input
                size="sm"
                placeholder="Unit"
                value={editForm.unit}
                onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
              />
              <Input
                size="sm"
                type="number"
                placeholder="Low stock threshold"
                value={editForm.lowStockThreshold}
                onChange={(e) =>
                  setEditForm({ ...editForm, lowStockThreshold: e.target.value })
                }
              />
              <Button size="sm" colorPalette="blue" onClick={handleUpdateItem}>
                Save changes
              </Button>
            </Stack>

            <Text fontWeight="semibold" mb={2}>
              Movements: {selectedItemData?.name}
            </Text>
            {movements.length === 0 ? (
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
        )}
      </Flex>
    </Box>
  );
}

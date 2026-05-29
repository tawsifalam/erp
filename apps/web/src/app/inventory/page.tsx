"use client";

import { useEffect, useState, useCallback } from "react";
import { Box, Button, Table, Text, Input, Flex, NativeSelect, Stack } from "@chakra-ui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader, EmptyState } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";

type Item = { id: string; name: string; sku: string; unit: string; currentStock: number; lowStockThreshold?: string };
type Movement = { id: string; direction: string; movementType: string; quantity: string; notes?: string; createdAt: string };

export default function InventoryPage() {
  const tenant = useTenantHeaders();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemForm, setItemForm] = useState({ name: "", sku: "", unit: "", lowStockThreshold: "" });
  const [movForm, setMovForm] = useState({ itemId: "", movementType: "PURCHASE", quantity: "", notes: "" });

  const load = useCallback(() => {
    if (!tenant.branchId) return;
    apiFetch<Item[]>(`/inventory/items?branchId=${tenant.branchId}`, { tenant }).then(setItems).catch(console.error);
  }, [tenant.branchId, tenant.organizationId]);

  useEffect(load, [load]);

  const loadMovements = async (itemId: string) => {
    setSelectedItem(itemId);
    const data = await apiFetch<Movement[]>(`/inventory/items/${itemId}/movements?branchId=${tenant.branchId}`, { tenant });
    setMovements(data);
  };

  const handleCreateItem = async () => {
    await apiFetch("/inventory/items", {
      method: "POST",
      tenant,
      body: JSON.stringify({
        branchId: tenant.branchId,
        name: itemForm.name,
        sku: itemForm.sku,
        unit: itemForm.unit,
        lowStockThreshold: itemForm.lowStockThreshold
          ? Number(itemForm.lowStockThreshold)
          : undefined,
      }),
    });
    setItemForm({ name: "", sku: "", unit: "", lowStockThreshold: "" });
    setShowItemForm(false);
    load();
  };

  const handleAddMovement = async () => {
    await apiFetch("/inventory/movements", {
      method: "POST",
      tenant,
      body: JSON.stringify({
        itemId: movForm.itemId,
        branchId: tenant.branchId,
        movementType: movForm.movementType,
        quantity: Number(movForm.quantity),
        notes: movForm.notes || undefined,
      }),
    });
    setMovForm({ itemId: "", movementType: "PURCHASE", quantity: "", notes: "" });
    setShowAdd(false);
    load();
    if (selectedItem) loadMovements(selectedItem);
  };

  const selectedItemData = items.find((i) => i.id === selectedItem);

  return (
    <DashboardShell title="Inventory">
      <PageHeader title="Stock Management" description="Ledger-based: Stock = SUM(IN) − SUM(OUT)" />
      <Flex gap={2} mb={4}>
        <Button size="sm" onClick={load}>Refresh</Button>
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
              <Input
                size="sm"
                w="180px"
                placeholder="Name"
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
              />
              <Input
                size="sm"
                w="120px"
                placeholder="SKU"
                value={itemForm.sku}
                onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
              />
              <Input
                size="sm"
                w="100px"
                placeholder="Unit"
                value={itemForm.unit}
                onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
              />
              <Input
                size="sm"
                w="120px"
                type="number"
                placeholder="Low stock at"
                value={itemForm.lowStockThreshold}
                onChange={(e) => setItemForm({ ...itemForm, lowStockThreshold: e.target.value })}
              />
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
              <NativeSelect.Root size="sm" w="200px">
                <NativeSelect.Field value={movForm.itemId} onChange={(e) => setMovForm({ ...movForm, itemId: e.target.value })}>
                  <option value="">Select Item</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                </NativeSelect.Field>
              </NativeSelect.Root>
              <NativeSelect.Root size="sm" w="160px">
                <NativeSelect.Field value={movForm.movementType} onChange={(e) => setMovForm({ ...movForm, movementType: e.target.value })}>
                  <option value="PURCHASE">Purchase (IN)</option>
                  <option value="SALE">Sale (OUT)</option>
                  <option value="WASTE">Waste (OUT)</option>
                  <option value="STAFF_MEAL">Staff Meal (OUT)</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </NativeSelect.Field>
              </NativeSelect.Root>
              <Input size="sm" w="100px" type="number" placeholder="Qty" value={movForm.quantity} onChange={(e) => setMovForm({ ...movForm, quantity: e.target.value })} />
              <Input size="sm" w="200px" placeholder="Notes (optional)" value={movForm.notes} onChange={(e) => setMovForm({ ...movForm, notes: e.target.value })} />
            </Flex>
            <Button size="sm" colorPalette="green" w="fit-content" onClick={handleAddMovement}>Record Movement</Button>
          </Stack>
        </Box>
      )}

      <Flex gap={4} wrap="wrap">
        <Box flex="1" minW="400px" bg="white" borderRadius="md" p={4}>
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>SKU</Table.ColumnHeader>
                <Table.ColumnHeader>Name</Table.ColumnHeader>
                <Table.ColumnHeader>On Hand</Table.ColumnHeader>
                <Table.ColumnHeader>Unit</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {items.map((i) => {
                const isLow = i.lowStockThreshold != null && i.currentStock <= Number(i.lowStockThreshold);
                return (
                  <Table.Row
                    key={i.id}
                    cursor="pointer"
                    bg={selectedItem === i.id ? "blue.50" : undefined}
                    onClick={() => loadMovements(i.id)}
                    _hover={{ bg: "gray.50" }}
                  >
                    <Table.Cell fontFamily="mono" fontSize="xs">{i.sku}</Table.Cell>
                    <Table.Cell>{i.name}</Table.Cell>
                    <Table.Cell fontWeight="bold" color={isLow ? "red.500" : undefined}>
                      {i.currentStock.toFixed(2)}
                    </Table.Cell>
                    <Table.Cell>{i.unit}</Table.Cell>
                    <Table.Cell>
                      {isLow ? <Text color="red.500" fontSize="xs" fontWeight="bold">LOW</Text> : <Text color="green.500" fontSize="xs">OK</Text>}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>

        {selectedItem && (
          <Box w="350px" bg="white" borderRadius="md" p={4}>
            <Text fontWeight="semibold" mb={2}>
              Movements: {selectedItemData?.name}
            </Text>
            {movements.length === 0 ? (
              <Text fontSize="sm" color="fg.muted">No movements recorded.</Text>
            ) : (
              <Stack gap={1}>
                {movements.slice(0, 20).map((m) => (
                  <Flex key={m.id} justify="space-between" fontSize="sm" borderBottomWidth="1px" pb={1}>
                    <Box>
                      <Text fontWeight="medium">
                        {m.direction === "IN" ? "+" : "−"}{Number(m.quantity).toFixed(2)}
                      </Text>
                      <Text fontSize="xs" color="fg.muted">{m.movementType}</Text>
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
    </DashboardShell>
  );
}

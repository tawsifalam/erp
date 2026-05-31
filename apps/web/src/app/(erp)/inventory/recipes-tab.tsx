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
import { AppSelect } from "@/components/app-select";
import { EmptyState, LoadingState } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { MenuCategory } from "@/lib/pos-types";

type InvItem = { id: string; name: string; sku: string; unit: string };

type RecipeLine = {
  inventoryItemId: string;
  quantity: number;
};

type Recipe = {
  menuItemId: string;
  lines: { inventoryItemId: string; quantity: string; inventoryItem: InvItem }[];
} | null;

export function RecipesTab({ tenant }: { tenant: TenantHeaders }) {
  const branchId = tenant.branchId;
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [invItems, setInvItems] = useState<InvItem[]>([]);
  const [menuItemId, setMenuItemId] = useState("");
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const menuItems = categories.flatMap((c) =>
    c.items.map((i) => ({ ...i, categoryName: c.name })),
  );

  const loadMeta = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const [menu, items] = await Promise.all([
        apiFetch<MenuCategory[]>(`/pos/menu/categories?branchId=${branchId}`, { tenant }),
        apiFetch<InvItem[]>(`/inventory/items?branchId=${branchId}&pool=guest`, { tenant }),
      ]);
      setCategories(menu);
      setInvItems(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [branchId, tenant.organizationId]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const loadRecipe = async (itemId: string) => {
    setMenuItemId(itemId);
    setSaved(false);
    if (!itemId) {
      setLines([]);
      return;
    }
    try {
      const recipe = await apiFetch<Recipe>(`/inventory/recipes/${itemId}`, { tenant });
      if (recipe?.lines?.length) {
        setLines(
          recipe.lines.map((l) => ({
            inventoryItemId: l.inventoryItemId,
            quantity: Number(l.quantity),
          })),
        );
      } else {
        setLines([{ inventoryItemId: "", quantity: 0 }]);
      }
    } catch {
      setLines([{ inventoryItemId: "", quantity: 0 }]);
    }
  };

  const addLine = () => {
    setLines((prev) => [...prev, { inventoryItemId: "", quantity: 0 }]);
  };

  const updateLine = (idx: number, patch: Partial<RecipeLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!menuItemId) return;
    const valid = lines.filter((l) => l.inventoryItemId && l.quantity > 0);
    try {
      await apiFetch("/inventory/recipes", {
        method: "POST",
        tenant,
        body: JSON.stringify({ menuItemId, lines: valid }),
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save recipe");
    }
  };

  if (!branchId) {
    return <EmptyState message="Select a branch in the header to manage recipes." />;
  }

  return (
    <Box>
      {error && (
        <Text color="red.500" mb={3} fontSize="sm">
          {error}
        </Text>
      )}
      {saved && (
        <Text color="green.600" mb={3} fontSize="sm">
          Recipe saved. POS order completion will deduct these ingredients.
        </Text>
      )}

      {loading && <LoadingState label="Loading menu and inventory…" />}
      {!loading && (
        <Box bg="white" borderRadius="md" p={4}>
          <Text fontWeight="semibold" mb={3}>
            Bill of materials (recipe)
          </Text>
          <Text fontSize="sm" color="fg.muted" mb={4}>
            Link a menu item to inventory ingredients. Quantities are per single menu item
            sold; multiplied by order line qty on complete.
          </Text>

          <AppSelect
            maxWidth="400px"
            items={[
              { value: "", label: "Select menu item" },
              ...menuItems.map((i) => ({
                value: i.id,
                label: `${i.categoryName} — ${i.name}`,
              })),
            ]}
            value={menuItemId}
            onValueChange={loadRecipe}
            placeholder="Select menu item"
          />

          {menuItemId && (
            <Stack gap={3} mt={4}>
              {lines.map((line, idx) => (
                <Flex key={idx} gap={2} wrap="wrap" align="center">
                  <AppSelect
                    width="240px"
                    items={[
                      { value: "", label: "Inventory item" },
                      ...invItems.map((i) => ({
                        value: i.id,
                        label: `${i.name} (${i.unit})`,
                      })),
                    ]}
                    value={line.inventoryItemId}
                    onValueChange={(v) => updateLine(idx, { inventoryItemId: v })}
                    placeholder="Inventory item"
                  />
                  <Input
                    size="sm"
                    w="100px"
                    type="number"
                    step="0.001"
                    placeholder="Qty"
                    value={line.quantity || ""}
                    onChange={(e) =>
                      updateLine(idx, { quantity: Number(e.target.value) || 0 })
                    }
                  />
                  <Button size="xs" variant="ghost" colorPalette="red" onClick={() => removeLine(idx)}>
                    Remove
                  </Button>
                </Flex>
              ))}
              <Flex gap={2}>
                <Button size="sm" variant="outline" onClick={addLine}>
                  + Ingredient line
                </Button>
                <Button size="sm" colorPalette="green" onClick={save}>
                  Save recipe
                </Button>
              </Flex>
            </Stack>
          )}

          {menuItems.length === 0 && (
            <EmptyState message="Add menu items under POS → Menu first." />
          )}
        </Box>
      )}
    </Box>
  );
}

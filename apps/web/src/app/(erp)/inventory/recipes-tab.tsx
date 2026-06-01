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
import { BranchRequiredNotice } from "@/components/branch-required-notice";
import { FormDrawer } from "@/components/form-drawer";
import { FormSection } from "@/components/form-section";
import {
  ContentCard,
  EmptyState,
  TableScrollArea,
  TableSkeleton,
} from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { MenuCategory } from "@/lib/pos-types";
import { appToast } from "@/lib/app-toast";

type InvItem = { id: string; name: string; sku: string; unit: string };

type RecipeLine = {
  inventoryItemId: string;
  quantity: number;
};

type Recipe = {
  menuItemId: string;
  lines: { inventoryItemId: string; quantity: string; inventoryItem: InvItem }[];
} | null;

type MenuItemRow = {
  id: string;
  name: string;
  categoryName: string;
  lineCount?: number;
};

export function RecipesTab({ tenant }: { tenant: TenantHeaders }) {
  const branchId = tenant.branchId;
  const [menuRows, setMenuRows] = useState<MenuItemRow[]>([]);
  const [invItems, setInvItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuItemId, setMenuItemId] = useState("");
  const [menuItemLabel, setMenuItemLabel] = useState("");
  const [lines, setLines] = useState<RecipeLine[]>([]);

  const loadMeta = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const [menu, items] = await Promise.all([
        apiFetch<MenuCategory[]>(`/pos/menu/categories?branchId=${branchId}`, { tenant }),
        apiFetch<InvItem[]>(`/inventory/items?branchId=${branchId}&pool=guest`, { tenant }),
      ]);
      const rows: MenuItemRow[] = menu.flatMap((c) =>
        c.items.map((i) => ({
          id: i.id,
          name: i.name,
          categoryName: c.name,
        })),
      );
      setMenuRows(rows);
      setInvItems(items);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [branchId, tenant]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const loadRecipe = async (itemId: string, label: string) => {
    setMenuItemId(itemId);
    setMenuItemLabel(label);
    setDrawerOpen(true);
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

  const closeDrawer = () => {
    setDrawerOpen(false);
    setMenuItemId("");
    setMenuItemLabel("");
    setLines([]);
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
      appToast.success("Recipe saved. POS order completion will deduct these ingredients.");
      closeDrawer();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to save recipe");
    }
  };

  if (!branchId) {
    return <BranchRequiredNotice />;
  }

  return (
    <>
      <Text fontSize="sm" color="fg.muted" mb={4}>
        Link menu items to inventory ingredients. Quantities are per single menu item sold;
        multiplied by order line qty on complete.
      </Text>

      <ContentCard p={0} overflow="hidden">
        {loading ? (
          <Box p={4}>
            <TableSkeleton rows={5} columns={3} />
          </Box>
        ) : menuRows.length === 0 ? (
          <Box p={4}>
            <EmptyState message="Add menu items under POS → Menu first." />
          </Box>
        ) : (
          <TableScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Category</Table.ColumnHeader>
                  <Table.ColumnHeader>Menu item</Table.ColumnHeader>
                  <Table.ColumnHeader />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {menuRows.map((row) => (
                  <Table.Row key={row.id}>
                    <Table.Cell>{row.categoryName}</Table.Cell>
                    <Table.Cell>{row.name}</Table.Cell>
                    <Table.Cell>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          loadRecipe(row.id, `${row.categoryName} — ${row.name}`)
                        }
                      >
                        Edit recipe
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </TableScrollArea>
        )}
      </ContentCard>

      <FormDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title="Bill of materials"
        description={menuItemLabel}
        size="md"
        primaryLabel="Save recipe"
        onPrimary={save}
        primaryDisabled={!menuItemId}
      >
        <FormSection title="Ingredients">
          <Stack gap={3} width="100%">
            {lines.map((line, idx) => (
              <Flex key={idx} gap={2} direction={{ base: "column", sm: "row" }} width="100%">
                <AppSelect
                  width="100%"
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
                  width="100%"
                  type="number"
                  step="0.001"
                  placeholder="Qty"
                  value={line.quantity || ""}
                  onChange={(e) =>
                    updateLine(idx, { quantity: Number(e.target.value) || 0 })
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  colorPalette="red"
                  alignSelf={{ sm: "center" }}
                  onClick={() => removeLine(idx)}
                >
                  Remove
                </Button>
              </Flex>
            ))}
            <Button size="sm" variant="outline" alignSelf="flex-start" onClick={addLine}>
              + Ingredient line
            </Button>
          </Stack>
        </FormSection>
      </FormDrawer>
    </>
  );
}

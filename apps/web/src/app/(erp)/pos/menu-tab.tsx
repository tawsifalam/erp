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
import {
  ContentCard,
  EmptyState,
  FormField,
  TableScrollArea,
  TableSkeleton,
} from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { MenuCategory } from "@/lib/pos-types";
import { appToast } from "@/lib/app-toast";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";

const emptyCatForm = () => ({ name: "", sortOrder: 0 });

const emptyItemForm = (categoryId = "") => ({
  categoryId,
  name: "",
  price: "",
  isActive: true,
  isGuestInclusionMeal: false,
});

export function MenuTab({ tenant }: { tenant: TenantHeaders }) {
  const { ask, dialog } = useConfirmDialog();
  const branchId = tenant.branchId;
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [catDrawer, setCatDrawer] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState(emptyCatForm);

  const [itemDrawer, setItemDrawer] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState(emptyItemForm());

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const data = await apiFetch<MenuCategory[]>(
        `/pos/menu/categories?branchId=${branchId}`,
        { tenant },
      );
      setCategories(data);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load menu");
    } finally {
      setLoading(false);
    }
  }, [branchId, tenant.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const openNewCategory = () => {
    setEditingCatId(null);
    setCatForm(emptyCatForm());
    setCatDrawer(true);
  };

  const openEditCategory = (cat: MenuCategory) => {
    setEditingCatId(cat.id);
    setCatForm({ name: cat.name, sortOrder: cat.sortOrder ?? 0 });
    setCatDrawer(true);
  };

  const closeCatDrawer = () => {
    setCatDrawer(false);
    setEditingCatId(null);
    setCatForm(emptyCatForm());
  };

  const saveCategory = async () => {
    if (!branchId || !catForm.name.trim()) return;
    try {
      if (editingCatId) {
        await apiFetch(`/pos/menu/categories/${editingCatId}?branchId=${branchId}`, {
          method: "PATCH",
          tenant,
          body: JSON.stringify({
            name: catForm.name,
            sortOrder: catForm.sortOrder,
          }),
        });
      } else {
        await apiFetch("/pos/menu/categories", {
          method: "POST",
          tenant,
          body: JSON.stringify({
            branchId,
            name: catForm.name,
            sortOrder: catForm.sortOrder,
          }),
        });
      }
      closeCatDrawer();
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to save category");
    }
  };

  const doRemoveCategory = async (id: string) => {
    if (!branchId) return;
    try {
      await apiFetch(`/pos/menu/categories/${id}?branchId=${branchId}`, {
        method: "DELETE",
        tenant,
      });
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Cannot delete category");
    }
  };

  const confirmRemoveCategory = (cat: MenuCategory) => {
    ask({
      title: "Delete category?",
      description: `"${cat.name}" and its items will be removed.`,
      confirmLabel: "Delete",
      onConfirm: () => doRemoveCategory(cat.id),
    });
  };

  const openNewItem = (categoryId?: string) => {
    setEditingItemId(null);
    setItemForm(emptyItemForm(categoryId ?? categories[0]?.id ?? ""));
    setItemDrawer(true);
  };

  const openEditItem = (
    cat: MenuCategory,
    item: MenuCategory["items"][number],
  ) => {
    setEditingItemId(item.id);
    setItemForm({
      categoryId: cat.id,
      name: item.name,
      price: String(item.price),
      isActive: item.isActive !== false,
      isGuestInclusionMeal: item.isGuestInclusionMeal === true,
    });
    setItemDrawer(true);
  };

  const closeItemDrawer = () => {
    setItemDrawer(false);
    setEditingItemId(null);
    setItemForm(emptyItemForm(categories[0]?.id ?? ""));
  };

  const saveItem = async () => {
    if (!itemForm.categoryId || !itemForm.name.trim() || !itemForm.price) return;
    try {
      const body = {
        categoryId: itemForm.categoryId,
        name: itemForm.name,
        price: Number(itemForm.price),
        isActive: itemForm.isActive,
        isGuestInclusionMeal: itemForm.isGuestInclusionMeal,
      };
      if (editingItemId) {
        await apiFetch(`/pos/menu/items/${editingItemId}`, {
          method: "PATCH",
          tenant,
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/pos/menu/items", { method: "POST", tenant, body: JSON.stringify(body) });
      }
      closeItemDrawer();
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to save item");
    }
  };

  const doRemoveItem = async (id: string) => {
    try {
      await apiFetch(`/pos/menu/items/${id}`, { method: "DELETE", tenant });
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Cannot delete item");
    }
  };

  const confirmRemoveItem = (itemName: string, id: string) => {
    ask({
      title: "Delete menu item?",
      description: `"${itemName}" will be permanently removed.`,
      confirmLabel: "Delete",
      onConfirm: () => doRemoveItem(id),
    });
  };

  if (!branchId) {
    return <BranchRequiredNotice />;
  }

  return (
    <>
      {dialog}
      <Flex gap={2} mb={4} wrap="wrap">
        <Button size="sm" onClick={load}>
          Refresh
        </Button>
        <Button
          size="sm"
          colorPalette="blue"
          w={{ base: "full", sm: "auto" }}
          onClick={openNewCategory}
        >
          + Add category
        </Button>
        <Button
          size="sm"
          variant="outline"
          w={{ base: "full", sm: "auto" }}
          onClick={() => openNewItem()}
          disabled={categories.length === 0}
        >
          + Add item
        </Button>
      </Flex>

      {loading ? (
        <ContentCard>
          <TableSkeleton rows={5} columns={3} />
        </ContentCard>
      ) : categories.length === 0 ? (
        <ContentCard>
          <EmptyState message="No menu categories. Add a category to get started." />
        </ContentCard>
      ) : (
        <Stack gap={4}>
          {categories.map((cat) => (
            <ContentCard key={cat.id} p={0} overflow="hidden">
              <Flex justify="space-between" align="center" px={4} pt={4} pb={2} wrap="wrap" gap={2}>
                <Text fontWeight="semibold">
                  {cat.name}
                  {cat.sortOrder != null ? ` (sort ${cat.sortOrder})` : ""}
                </Text>
                <Flex gap={1}>
                  <Button size="xs" variant="outline" onClick={() => openNewItem(cat.id)}>
                    + Item
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => openEditCategory(cat)}>
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    colorPalette="red"
                    variant="outline"
                    onClick={() => confirmRemoveCategory(cat)}
                  >
                    Delete
                  </Button>
                </Flex>
              </Flex>
              {cat.items.length === 0 ? (
                <Box px={4} pb={4}>
                  <Text fontSize="sm" color="fg.muted">
                    No items in this category.
                  </Text>
                </Box>
              ) : (
                <TableScrollArea>
                  <Table.Root size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Item</Table.ColumnHeader>
                        <Table.ColumnHeader>Price</Table.ColumnHeader>
                        <Table.ColumnHeader>Actions</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {cat.items.map((item) => (
                        <Table.Row key={item.id}>
                          <Table.Cell>
                            {item.name}
                            {item.isActive === false && (
                              <Text as="span" fontSize="xs" color="fg.muted">
                                {" "}
                                (inactive)
                              </Text>
                            )}
                            {item.isGuestInclusionMeal && (
                              <Text as="span" fontSize="xs" color="blue.600">
                                {" "}
                                (inclusion meal)
                              </Text>
                            )}
                          </Table.Cell>
                          <Table.Cell>৳{Number(item.price).toLocaleString()}</Table.Cell>
                          <Table.Cell>
                            <Flex gap={1}>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => openEditItem(cat, item)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="xs"
                                colorPalette="red"
                                variant="outline"
                                onClick={() => confirmRemoveItem(item.name, item.id)}
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
              )}
            </ContentCard>
          ))}
        </Stack>
      )}

      <FormDrawer
        open={catDrawer}
        onClose={closeCatDrawer}
        title={editingCatId ? "Edit category" : "New category"}
        size="sm"
        primaryLabel={editingCatId ? "Update" : "Create"}
        onPrimary={saveCategory}
        primaryDisabled={!catForm.name.trim()}
      >
        <Stack gap={4} width="100%">
          <FormField label="Category name" required>
            <Input
              size="sm"
              width="100%"
              placeholder="Category name"
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
            />
          </FormField>
          <FormField label="Sort order" help="Lower numbers appear first.">
            <Input
              size="sm"
              width="100%"
              type="number"
              value={catForm.sortOrder}
              onChange={(e) =>
                setCatForm({ ...catForm, sortOrder: Number(e.target.value) || 0 })
              }
            />
          </FormField>
        </Stack>
      </FormDrawer>

      <FormDrawer
        open={itemDrawer}
        onClose={closeItemDrawer}
        title={editingItemId ? "Edit menu item" : "New menu item"}
        size="sm"
        primaryLabel={editingItemId ? "Update" : "Create"}
        onPrimary={saveItem}
        primaryDisabled={!itemForm.categoryId || !itemForm.name.trim() || !itemForm.price}
      >
        <Stack gap={4} width="100%">
          <FormField label="Category" required>
            <AppSelect
              width="100%"
              items={[
                { value: "", label: "Category" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={itemForm.categoryId}
              onValueChange={(v) => setItemForm({ ...itemForm, categoryId: v })}
              placeholder="Category"
            />
          </FormField>
          <FormField label="Item name" required>
            <Input
              size="sm"
              width="100%"
              placeholder="Item name"
              value={itemForm.name}
              onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
            />
          </FormField>
          <FormField label="Price" required>
            <Input
              size="sm"
              width="100%"
              type="number"
              placeholder="Price"
              value={itemForm.price}
              onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
            />
          </FormField>
          <FormField label="Status">
            <AppSelect
              width="100%"
              items={[
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ]}
              value={itemForm.isActive ? "true" : "false"}
              onValueChange={(v) => setItemForm({ ...itemForm, isActive: v === "true" })}
            />
          </FormField>
          <FormField label="Guest inclusion meal" help="Counts toward room package meals at POS.">
            <AppSelect
              width="100%"
              items={[
                { value: "false", label: "Regular item" },
                { value: "true", label: "Guest inclusion meal" },
              ]}
              value={itemForm.isGuestInclusionMeal ? "true" : "false"}
              onValueChange={(v) =>
                setItemForm({ ...itemForm, isGuestInclusionMeal: v === "true" })
              }
            />
          </FormField>
        </Stack>
      </FormDrawer>
    </>
  );
}

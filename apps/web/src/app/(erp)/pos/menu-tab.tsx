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
import { EmptyState, FormField, TableSkeleton } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { MenuCategory } from "@/lib/pos-types";
import { appToast } from "@/lib/app-toast";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";

export function MenuTab({ tenant }: { tenant: TenantHeaders }) {
  const { ask, dialog } = useConfirmDialog();
  const branchId = tenant.branchId;
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [catForm, setCatForm] = useState({ name: "", sortOrder: 0 });
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({
    categoryId: "",
    name: "",
    price: "",
    isActive: true,
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const data = await apiFetch<MenuCategory[]>(
        `/pos/menu/categories?branchId=${branchId}`,
        { tenant },
      );
      setCategories(data);
      if (!itemForm.categoryId && data[0]) {
        setItemForm((f) => ({ ...f, categoryId: data[0].id }));
      }
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load menu");
    } finally {
      setLoading(false);
    }
  }, [branchId, tenant.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

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
      setCatForm({ name: "", sortOrder: 0 });
      setEditingCatId(null);
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

  const saveItem = async () => {
    if (!itemForm.categoryId || !itemForm.name.trim() || !itemForm.price) return;
    try {
      const body = {
        categoryId: itemForm.categoryId,
        name: itemForm.name,
        price: Number(itemForm.price),
        isActive: itemForm.isActive,
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
      setItemForm({ categoryId: itemForm.categoryId, name: "", price: "", isActive: true });
      setEditingItemId(null);
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
      <Box>

      <Box bg="white" borderRadius="md" p={4} mb={4}>
        <Text fontWeight="semibold" mb={3}>
          {editingCatId ? "Edit category" : "New category"}
        </Text>
        <Flex gap={2} wrap="wrap" mb={2}>
          <FormField label="Category name" required>
            <Input
              size="sm"
              w="200px"
              placeholder="Category name"
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
            />
          </FormField>
          <Input
            size="sm"
            w="80px"
            type="number"
            placeholder="Sort"
            value={catForm.sortOrder}
            onChange={(e) => setCatForm({ ...catForm, sortOrder: Number(e.target.value) || 0 })}
          />
          <Box alignSelf="flex-end">
            <Button size="sm" colorPalette="green" onClick={saveCategory}>
              {editingCatId ? "Update" : "Add category"}
            </Button>
          </Box>
          {editingCatId && (
            <Box alignSelf="flex-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingCatId(null);
                  setCatForm({ name: "", sortOrder: 0 });
                }}
              >
                Cancel
              </Button>
            </Box>
          )}
        </Flex>
      </Box>

      <Box bg="white" borderRadius="md" p={4} mb={4}>
        <Text fontWeight="semibold" mb={3}>
          {editingItemId ? "Edit menu item" : "New menu item"}
        </Text>
        <Flex gap={2} wrap="wrap" mb={2}>
          <FormField label="Category" required>
            <AppSelect
              width="180px"
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
              w="180px"
              placeholder="Item name"
              value={itemForm.name}
              onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
            />
          </FormField>
          <FormField label="Price" required>
            <Input
              size="sm"
              w="100px"
              type="number"
              placeholder="Price"
              value={itemForm.price}
              onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
            />
          </FormField>
          <AppSelect
            width="120px"
            items={[
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ]}
            value={itemForm.isActive ? "true" : "false"}
            onValueChange={(v) => setItemForm({ ...itemForm, isActive: v === "true" })}
          />
          <Box alignSelf="flex-end">
            <Button size="sm" colorPalette="green" onClick={saveItem}>
              {editingItemId ? "Update" : "Add item"}
            </Button>
          </Box>
          {editingItemId && (
            <Box alignSelf="flex-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingItemId(null);
                  setItemForm({ categoryId: itemForm.categoryId, name: "", price: "", isActive: true });
                }}
              >
                Cancel
              </Button>
            </Box>
          )}
        </Flex>
      </Box>

      {loading ? (
        <Box bg="white" borderRadius="md" p={4}>
          <TableSkeleton rows={5} columns={3} />
        </Box>
      ) : (
        <Stack gap={4}>
          {categories.map((cat) => (
            <Box key={cat.id} bg="white" borderRadius="md" p={4}>
              <Flex justify="space-between" align="center" mb={2}>
                <Text fontWeight="semibold">
                  {cat.name}
                  {cat.sortOrder != null ? ` (sort ${cat.sortOrder})` : ""}
                </Text>
                <Flex gap={1}>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setEditingCatId(cat.id);
                      setCatForm({ name: cat.name, sortOrder: cat.sortOrder ?? 0 });
                    }}
                  >
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
                      </Table.Cell>
                      <Table.Cell>৳{Number(item.price).toLocaleString()}</Table.Cell>
                      <Table.Cell>
                        <Flex gap={1}>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => {
                              setEditingItemId(item.id);
                              setItemForm({
                                categoryId: cat.id,
                                name: item.name,
                                price: String(item.price),
                                isActive: item.isActive !== false,
                              });
                            }}
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
              {cat.items.length === 0 && (
                <Text fontSize="sm" color="fg.muted">
                  No items in this category.
                </Text>
              )}
            </Box>
          ))}
          {categories.length === 0 && (
            <EmptyState message="No menu categories. Create one above." />
          )}
        </Stack>
      )}
    </Box>
    </>
  );
}

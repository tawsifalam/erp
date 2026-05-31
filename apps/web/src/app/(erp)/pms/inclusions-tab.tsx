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
import { InclusionType } from "@erp/types";
import { appToast } from "@/lib/app-toast";

type InvItem = { id: string; name: string; unit: string };

type InclusionRecipe = {
  id: string;
  name: string;
  inclusionType: string;
  lines: {
    inventoryItemId: string;
    quantity: string;
    inventoryItem: InvItem;
  }[];
};

type InclusionPackage = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  rules: {
    id: string;
    inclusionType: string;
    inclusionRecipeId: string;
    quantityPerGuestPerNight: number | null;
    quantityPerGuestPerStay: number | null;
    autoIssueOnCheckIn: boolean;
    recipe: { id: string; name: string; inclusionType: string };
  }[];
};

export function InclusionsTab({ tenant }: { tenant: TenantHeaders }) {
  const branchId = tenant.branchId;
  const [recipes, setRecipes] = useState<InclusionRecipe[]>([]);
  const [packages, setPackages] = useState<InclusionPackage[]>([]);
  const [guestItems, setGuestItems] = useState<InvItem[]>([]);
  const [hkItems, setHkItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [recipeForm, setRecipeForm] = useState({
    name: "",
    inclusionType: InclusionType.MEAL as InclusionType,
    lines: [{ inventoryItemId: "", quantity: "" }],
  });
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  const [pkgForm, setPkgForm] = useState({
    name: "",
    isDefault: false,
    mealRecipeId: "",
    mealsPerGuestPerNight: "3",
    amenityRecipeId: "",
    amenityPerGuestPerStay: "1",
  });

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const [recipeData, pkgData, guestInv, hkInv] = await Promise.all([
        apiFetch<InclusionRecipe[]>(`/inclusions/recipes?branchId=${branchId}`, { tenant }),
        apiFetch<InclusionPackage[]>("/inclusions/packages", { tenant }),
        apiFetch<InvItem[]>(`/inventory/items?branchId=${branchId}&pool=guest`, { tenant }),
        apiFetch<InvItem[]>(`/inventory/items?branchId=${branchId}&pool=housekeeping`, {
          tenant,
        }),
      ]);
      setRecipes(recipeData);
      setPackages(pkgData);
      setGuestItems(guestInv);
      setHkItems(hkInv);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load inclusions");
    } finally {
      setLoading(false);
    }
  }, [branchId, tenant]);

  useEffect(() => {
    load();
  }, [load]);

  const saveRecipe = async () => {
    if (!branchId || !recipeForm.name.trim()) return;
    const lines = recipeForm.lines
      .filter((l) => l.inventoryItemId && Number(l.quantity) > 0)
      .map((l) => ({ inventoryItemId: l.inventoryItemId, quantity: Number(l.quantity) }));
    if (lines.length === 0) {
      appToast.error("Add at least one ingredient line.");
      return;
    }
    try {
      const body = {
        branchId,
        name: recipeForm.name,
        inclusionType: recipeForm.inclusionType,
        lines,
      };
      if (editingRecipeId) {
        await apiFetch(`/inclusions/recipes/${editingRecipeId}`, {
          method: "PUT",
          tenant,
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/inclusions/recipes", { method: "POST", tenant, body: JSON.stringify(body) });
      }
      setRecipeForm({
        name: "",
        inclusionType: InclusionType.MEAL,
        lines: [{ inventoryItemId: "", quantity: "" }],
      });
      setEditingRecipeId(null);
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to save recipe");
    }
  };

  const savePackage = async () => {
    if (!pkgForm.name.trim()) return;
    const rules = [];
    if (pkgForm.mealRecipeId && Number(pkgForm.mealsPerGuestPerNight) > 0) {
      rules.push({
        inclusionType: InclusionType.MEAL,
        inclusionRecipeId: pkgForm.mealRecipeId,
        quantityPerGuestPerNight: Number(pkgForm.mealsPerGuestPerNight),
      });
    }
    if (pkgForm.amenityRecipeId && Number(pkgForm.amenityPerGuestPerStay) > 0) {
      rules.push({
        inclusionType: InclusionType.AMENITY_KIT,
        inclusionRecipeId: pkgForm.amenityRecipeId,
        quantityPerGuestPerStay: Number(pkgForm.amenityPerGuestPerStay),
        autoIssueOnCheckIn: true,
      });
    }
    if (rules.length === 0) {
      appToast.error("Add at least one meal or amenity rule.");
      return;
    }
    try {
      await apiFetch("/inclusions/packages", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          name: pkgForm.name,
          isDefault: pkgForm.isDefault,
          rules,
        }),
      });
      setPkgForm({
        name: "",
        isDefault: false,
        mealRecipeId: "",
        mealsPerGuestPerNight: "3",
        amenityRecipeId: "",
        amenityPerGuestPerStay: "1",
      });
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to save package");
    }
  };

  const inventoryForType =
    recipeForm.inclusionType === InclusionType.MEAL ? guestItems : hkItems;
  const mealRecipes = recipes.filter((r) => r.inclusionType === InclusionType.MEAL);
  const amenityRecipes = recipes.filter((r) => r.inclusionType === InclusionType.AMENITY_KIT);

  if (!branchId) {
    return <BranchRequiredNotice />;
  }

  if (loading) {
    return <TableSkeleton rows={4} columns={4} />;
  }

  return (
    <Stack gap={6}>
      <Box bg="white" borderRadius="md" p={4}>
        <Text fontWeight="semibold" mb={3}>
          {editingRecipeId ? "Edit inclusion recipe" : "New inclusion recipe"}
        </Text>
        <Flex gap={2} wrap="wrap" mb={3}>
          <FormField label="Name" required>
            <Input
              size="sm"
              w="200px"
              value={recipeForm.name}
              onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
            />
          </FormField>
          <FormField label="Type">
            <AppSelect
              width="160px"
              items={[
                { value: InclusionType.MEAL, label: "Meal (guest pool)" },
                { value: InclusionType.AMENITY_KIT, label: "Amenity kit (HK pool)" },
              ]}
              value={recipeForm.inclusionType}
              onValueChange={(v) =>
                setRecipeForm({
                  ...recipeForm,
                  inclusionType: v as InclusionType,
                  lines: [{ inventoryItemId: "", quantity: "" }],
                })
              }
            />
          </FormField>
        </Flex>
        {recipeForm.lines.map((line, idx) => (
          <Flex key={idx} gap={2} mb={2} wrap="wrap">
            <AppSelect
              width="220px"
              items={[
                { value: "", label: "Ingredient" },
                ...inventoryForType.map((i) => ({ value: i.id, label: i.name })),
              ]}
              value={line.inventoryItemId}
              onValueChange={(v) => {
                const lines = [...recipeForm.lines];
                lines[idx] = { ...lines[idx], inventoryItemId: v };
                setRecipeForm({ ...recipeForm, lines });
              }}
              placeholder="Ingredient"
            />
            <Input
              size="sm"
              w="100px"
              type="number"
              placeholder="Qty"
              value={line.quantity}
              onChange={(e) => {
                const lines = [...recipeForm.lines];
                lines[idx] = { ...lines[idx], quantity: e.target.value };
                setRecipeForm({ ...recipeForm, lines });
              }}
            />
          </Flex>
        ))}
        <Flex gap={2} mt={2}>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setRecipeForm({
                ...recipeForm,
                lines: [...recipeForm.lines, { inventoryItemId: "", quantity: "" }],
              })
            }
          >
            + Line
          </Button>
          <Button size="sm" colorPalette="green" onClick={saveRecipe}>
            Save recipe
          </Button>
        </Flex>
      </Box>

      <Box bg="white" borderRadius="md" p={4}>
        <Text fontWeight="semibold" mb={3}>
          Recipes
        </Text>
        {recipes.length === 0 ? (
          <EmptyState title="No recipes" description="Create meal or amenity kit BOMs above." />
        ) : (
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Name</Table.ColumnHeader>
                <Table.ColumnHeader>Type</Table.ColumnHeader>
                <Table.ColumnHeader>Lines</Table.ColumnHeader>
                <Table.ColumnHeader />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {recipes.map((r) => (
                <Table.Row key={r.id}>
                  <Table.Cell>{r.name}</Table.Cell>
                  <Table.Cell>{r.inclusionType}</Table.Cell>
                  <Table.Cell>
                    {r.lines
                      .map((l) => `${l.inventoryItem.name} × ${l.quantity}`)
                      .join(", ")}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setEditingRecipeId(r.id);
                        setRecipeForm({
                          name: r.name,
                          inclusionType: r.inclusionType as InclusionType,
                          lines: r.lines.map((l) => ({
                            inventoryItemId: l.inventoryItemId,
                            quantity: String(l.quantity),
                          })),
                        });
                      }}
                    >
                      Edit
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Box>

      <Box bg="white" borderRadius="md" p={4}>
        <Text fontWeight="semibold" mb={3}>
          New guest package
        </Text>
        <Flex gap={2} wrap="wrap" mb={3}>
          <FormField label="Package name" required>
            <Input
              size="sm"
              w="200px"
              value={pkgForm.name}
              onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
            />
          </FormField>
          <FormField label="Meals/guest/night">
            <Input
              size="sm"
              w="80px"
              type="number"
              value={pkgForm.mealsPerGuestPerNight}
              onChange={(e) =>
                setPkgForm({ ...pkgForm, mealsPerGuestPerNight: e.target.value })
              }
            />
          </FormField>
          <FormField label="Meal recipe">
            <AppSelect
              width="200px"
              items={[
                { value: "", label: "Meal recipe" },
                ...mealRecipes.map((r) => ({ value: r.id, label: r.name })),
              ]}
              value={pkgForm.mealRecipeId}
              onValueChange={(v) => setPkgForm({ ...pkgForm, mealRecipeId: v })}
            />
          </FormField>
          <FormField label="Amenity recipe">
            <AppSelect
              width="200px"
              items={[
                { value: "", label: "Amenity kit" },
                ...amenityRecipes.map((r) => ({ value: r.id, label: r.name })),
              ]}
              value={pkgForm.amenityRecipeId}
              onValueChange={(v) => setPkgForm({ ...pkgForm, amenityRecipeId: v })}
            />
          </FormField>
        </Flex>
        <Button size="sm" colorPalette="green" onClick={savePackage}>
          Create package
        </Button>
      </Box>

      <Box bg="white" borderRadius="md" p={4}>
        <Text fontWeight="semibold" mb={3}>
          Packages
        </Text>
        {packages.length === 0 ? (
          <EmptyState title="No packages" description="Create a guest inclusion package above." />
        ) : (
          packages.map((p) => (
            <Box key={p.id} mb={3} p={3} borderWidth="1px" borderRadius="md">
              <Flex gap={2} align="center" mb={1}>
                <Text fontWeight="medium">{p.name}</Text>
                {p.isDefault && (
                  <Text fontSize="xs" color="fg.muted">
                    (default)
                  </Text>
                )}
              </Flex>
              {p.rules.map((rule) => (
                <Text key={rule.id} fontSize="sm" color="fg.muted">
                  {rule.inclusionType === InclusionType.MEAL
                    ? `${rule.quantityPerGuestPerNight} meals/guest/night — ${rule.recipe.name}`
                    : `${rule.quantityPerGuestPerStay} kit/guest/stay${rule.autoIssueOnCheckIn ? " (auto on check-in)" : ""} — ${rule.recipe.name}`}
                </Text>
              ))}
            </Box>
          ))
        )}
      </Box>
    </Stack>
  );
}

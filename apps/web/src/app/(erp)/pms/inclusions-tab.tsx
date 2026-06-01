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
  FormField,
  TableScrollArea,
  TableSkeleton,
} from "@erp/ui";
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

const emptyRecipeForm = () => ({
  name: "",
  inclusionType: InclusionType.MEAL as InclusionType,
  lines: [{ inventoryItemId: "", quantity: "" }],
});

const emptyPkgForm = () => ({
  name: "",
  isDefault: false,
  mealRecipeId: "",
  mealsPerGuestPerNight: "3",
  amenityRecipeId: "",
  amenityPerGuestPerStay: "1",
});

export function InclusionsTab({ tenant }: { tenant: TenantHeaders }) {
  const branchId = tenant.branchId;
  const [recipes, setRecipes] = useState<InclusionRecipe[]>([]);
  const [packages, setPackages] = useState<InclusionPackage[]>([]);
  const [guestItems, setGuestItems] = useState<InvItem[]>([]);
  const [hkItems, setHkItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [recipeDrawer, setRecipeDrawer] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [recipeForm, setRecipeForm] = useState(emptyRecipeForm);

  const [packageDrawer, setPackageDrawer] = useState(false);
  const [pkgForm, setPkgForm] = useState(emptyPkgForm);

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

  const openNewRecipe = () => {
    setEditingRecipeId(null);
    setRecipeForm(emptyRecipeForm());
    setRecipeDrawer(true);
  };

  const openEditRecipe = (r: InclusionRecipe) => {
    setEditingRecipeId(r.id);
    setRecipeForm({
      name: r.name,
      inclusionType: r.inclusionType as InclusionType,
      lines: r.lines.map((l) => ({
        inventoryItemId: l.inventoryItemId,
        quantity: String(l.quantity),
      })),
    });
    setRecipeDrawer(true);
  };

  const closeRecipeDrawer = () => {
    setRecipeDrawer(false);
    setEditingRecipeId(null);
    setRecipeForm(emptyRecipeForm());
  };

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
      closeRecipeDrawer();
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to save recipe");
    }
  };

  const openNewPackage = () => {
    setPkgForm(emptyPkgForm());
    setPackageDrawer(true);
  };

  const closePackageDrawer = () => {
    setPackageDrawer(false);
    setPkgForm(emptyPkgForm());
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
      closePackageDrawer();
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
      <Flex gap={2} wrap="wrap">
        <Button size="sm" onClick={load}>
          Refresh
        </Button>
        <Button size="sm" colorPalette="blue" w={{ base: "full", sm: "auto" }} onClick={openNewRecipe}>
          + New recipe
        </Button>
        <Button
          size="sm"
          colorPalette="blue"
          variant="outline"
          w={{ base: "full", sm: "auto" }}
          onClick={openNewPackage}
        >
          + New package
        </Button>
      </Flex>

      <ContentCard p={0} overflow="hidden">
        <Box px={4} pt={4} pb={2}>
          <Text fontWeight="semibold">Inclusion recipes</Text>
        </Box>
        {recipes.length === 0 ? (
          <Box p={4}>
            <EmptyState title="No recipes" description="Create meal or amenity kit BOMs." />
          </Box>
        ) : (
          <TableScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Name</Table.ColumnHeader>
                  <Table.ColumnHeader display={{ base: "none", sm: "table-cell" }}>
                    Type
                  </Table.ColumnHeader>
                  <Table.ColumnHeader display={{ base: "none", md: "table-cell" }}>
                    Lines
                  </Table.ColumnHeader>
                  <Table.ColumnHeader />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {recipes.map((r) => (
                  <Table.Row key={r.id}>
                    <Table.Cell>{r.name}</Table.Cell>
                    <Table.Cell display={{ base: "none", sm: "table-cell" }}>
                      {r.inclusionType}
                    </Table.Cell>
                    <Table.Cell display={{ base: "none", md: "table-cell" }}>
                      {r.lines.map((l) => `${l.inventoryItem.name} × ${l.quantity}`).join(", ")}
                    </Table.Cell>
                    <Table.Cell>
                      <Button size="xs" variant="outline" onClick={() => openEditRecipe(r)}>
                        Edit
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </TableScrollArea>
        )}
      </ContentCard>

      <ContentCard p={4}>
        <Text fontWeight="semibold" mb={3}>
          Guest packages
        </Text>
        {packages.length === 0 ? (
          <EmptyState title="No packages" description="Create a guest inclusion package." />
        ) : (
          <Stack gap={3}>
            {packages.map((p) => (
              <Box key={p.id} p={3} borderWidth="1px" borderRadius="md">
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
            ))}
          </Stack>
        )}
      </ContentCard>

      <FormDrawer
        open={recipeDrawer}
        onClose={closeRecipeDrawer}
        title={editingRecipeId ? "Edit inclusion recipe" : "New inclusion recipe"}
        size="md"
        primaryLabel="Save recipe"
        onPrimary={saveRecipe}
        primaryDisabled={!recipeForm.name.trim()}
      >
        <FormSection title="Recipe details">
          <FormField label="Name" required>
            <Input
              size="sm"
              width="100%"
              value={recipeForm.name}
              onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
            />
          </FormField>
          <FormField label="Type">
            <AppSelect
              width="100%"
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
        </FormSection>

        <FormSection title="Ingredients">
          <Stack gap={3} width="100%">
            {recipeForm.lines.map((line, idx) => (
              <Flex key={idx} gap={2} direction={{ base: "column", sm: "row" }} width="100%">
                <AppSelect
                  width="100%"
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
                  width="100%"
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
            <Button
              size="sm"
              variant="outline"
              alignSelf="flex-start"
              onClick={() =>
                setRecipeForm({
                  ...recipeForm,
                  lines: [...recipeForm.lines, { inventoryItemId: "", quantity: "" }],
                })
              }
            >
              + Line
            </Button>
          </Stack>
        </FormSection>
      </FormDrawer>

      <FormDrawer
        open={packageDrawer}
        onClose={closePackageDrawer}
        title="New guest package"
        size="md"
        primaryLabel="Create package"
        onPrimary={savePackage}
        primaryDisabled={!pkgForm.name.trim()}
      >
        <Stack gap={4} width="100%">
          <FormField label="Package name" required>
            <Input
              size="sm"
              width="100%"
              value={pkgForm.name}
              onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
            />
          </FormField>
          <Flex align="center" gap={2}>
            <input
              type="checkbox"
              checked={pkgForm.isDefault}
              onChange={(e) => setPkgForm({ ...pkgForm, isDefault: e.target.checked })}
            />
            <Text fontSize="sm">Default package for new reservations</Text>
          </Flex>
          <FormSection title="Meal allowance">
            <FormField label="Meals per guest per night">
              <Input
                size="sm"
                width="100%"
                type="number"
                value={pkgForm.mealsPerGuestPerNight}
                onChange={(e) =>
                  setPkgForm({ ...pkgForm, mealsPerGuestPerNight: e.target.value })
                }
              />
            </FormField>
            <FormField label="Meal recipe">
              <AppSelect
                width="100%"
                items={[
                  { value: "", label: "Meal recipe" },
                  ...mealRecipes.map((r) => ({ value: r.id, label: r.name })),
                ]}
                value={pkgForm.mealRecipeId}
                onValueChange={(v) => setPkgForm({ ...pkgForm, mealRecipeId: v })}
              />
            </FormField>
          </FormSection>
          <FormSection title="Amenity kit">
            <FormField label="Kits per guest per stay">
              <Input
                size="sm"
                width="100%"
                type="number"
                value={pkgForm.amenityPerGuestPerStay}
                onChange={(e) =>
                  setPkgForm({ ...pkgForm, amenityPerGuestPerStay: e.target.value })
                }
              />
            </FormField>
            <FormField label="Amenity recipe">
              <AppSelect
                width="100%"
                items={[
                  { value: "", label: "Amenity kit" },
                  ...amenityRecipes.map((r) => ({ value: r.id, label: r.name })),
                ]}
                value={pkgForm.amenityRecipeId}
                onValueChange={(v) => setPkgForm({ ...pkgForm, amenityRecipeId: v })}
              />
            </FormField>
          </FormSection>
        </Stack>
      </FormDrawer>
    </Stack>
  );
}

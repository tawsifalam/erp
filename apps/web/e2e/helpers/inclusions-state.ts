/** Mutable inclusions state for Playwright route mocks. */

import { getPmsReservations } from "./pms-state";

const MOCK_ORG_A = "org-test-001";
const MOCK_ORG_B = "org-test-002";
const MOCK_BRANCH_A1 = "branch-test-001";
const MOCK_BRANCH_A2 = "branch-test-002";

export type MockAllowance = {
  id: string;
  inclusionType: string;
  inclusionRecipeId: string;
  recipeName: string;
  entitledQty: number;
  consumedQty: number;
  remainingQty: number;
  unitLabel: string;
};

export type MockInclusionPackage = {
  id: string;
  organizationId: string;
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

export type MockInclusionRecipe = {
  id: string;
  branchId: string;
  name: string;
  inclusionType: string;
  lines: {
    inventoryItemId: string;
    quantity: number;
    inventoryItem: { id: string; name: string; unit: string };
  }[];
};

const INITIAL_PACKAGES: MockInclusionPackage[] = [
  {
    id: "ipkg-full",
    organizationId: MOCK_ORG_A,
    name: "Full board (3 meals)",
    isDefault: true,
    isActive: true,
    rules: [
      {
        id: "ipr-breakfast",
        inclusionType: "MEAL",
        inclusionRecipeId: "ir-breakfast",
        quantityPerGuestPerNight: 1,
        quantityPerGuestPerStay: null,
        autoIssueOnCheckIn: false,
        recipe: { id: "ir-breakfast", name: "Breakfast meal", inclusionType: "MEAL" },
      },
      {
        id: "ipr-lunch",
        inclusionType: "MEAL",
        inclusionRecipeId: "ir-lunch",
        quantityPerGuestPerNight: 1,
        quantityPerGuestPerStay: null,
        autoIssueOnCheckIn: false,
        recipe: { id: "ir-lunch", name: "Lunch meal", inclusionType: "MEAL" },
      },
      {
        id: "ipr-dinner",
        inclusionType: "MEAL",
        inclusionRecipeId: "ir-dinner",
        quantityPerGuestPerNight: 1,
        quantityPerGuestPerStay: null,
        autoIssueOnCheckIn: false,
        recipe: { id: "ir-dinner", name: "Dinner meal", inclusionType: "MEAL" },
      },
      {
        id: "ipr-kit",
        inclusionType: "AMENITY_KIT",
        inclusionRecipeId: "ir-kit",
        quantityPerGuestPerNight: null,
        quantityPerGuestPerStay: 1,
        autoIssueOnCheckIn: true,
        recipe: { id: "ir-kit", name: "Standard amenity kit", inclusionType: "AMENITY_KIT" },
      },
    ],
  },
  {
    id: "ipkg-budget",
    organizationId: MOCK_ORG_A,
    name: "Budget (1 meal)",
    isDefault: false,
    isActive: true,
    rules: [
      {
        id: "ipr-budget",
        inclusionType: "MEAL",
        inclusionRecipeId: "ir-breakfast",
        quantityPerGuestPerNight: 1,
        quantityPerGuestPerStay: null,
        autoIssueOnCheckIn: false,
        recipe: { id: "ir-breakfast", name: "Breakfast meal", inclusionType: "MEAL" },
      },
    ],
  },
  {
    id: "ipkg-harbor",
    organizationId: MOCK_ORG_B,
    name: "Harbor breakfast",
    isDefault: true,
    isActive: true,
    rules: [
      {
        id: "ipr-harbor",
        inclusionType: "MEAL",
        inclusionRecipeId: "ir-breakfast",
        quantityPerGuestPerNight: 1,
        quantityPerGuestPerStay: null,
        autoIssueOnCheckIn: false,
        recipe: { id: "ir-breakfast", name: "Breakfast meal", inclusionType: "MEAL" },
      },
    ],
  },
];

const INITIAL_RECIPES: MockInclusionRecipe[] = [
  {
    id: "ir-breakfast",
    branchId: MOCK_BRANCH_A1,
    name: "Breakfast meal",
    inclusionType: "MEAL",
    lines: [
      {
        inventoryItemId: "inv-eggs",
        quantity: 2,
        inventoryItem: { id: "inv-eggs", name: "Eggs", unit: "pcs" },
      },
      {
        inventoryItemId: "inv-bread",
        quantity: 2,
        inventoryItem: { id: "inv-bread", name: "Bread", unit: "pcs" },
      },
    ],
  },
  {
    id: "ir-lunch",
    branchId: MOCK_BRANCH_A1,
    name: "Lunch meal",
    inclusionType: "MEAL",
    lines: [
      {
        inventoryItemId: "inv-rice",
        quantity: 0.15,
        inventoryItem: { id: "inv-rice", name: "Rice", unit: "kg" },
      },
      {
        inventoryItemId: "inv-chicken",
        quantity: 0.1,
        inventoryItem: { id: "inv-chicken", name: "Chicken", unit: "kg" },
      },
    ],
  },
  {
    id: "ir-dinner",
    branchId: MOCK_BRANCH_A1,
    name: "Dinner meal",
    inclusionType: "MEAL",
    lines: [
      {
        inventoryItemId: "inv-rice",
        quantity: 0.15,
        inventoryItem: { id: "inv-rice", name: "Rice", unit: "kg" },
      },
      {
        inventoryItemId: "inv-chicken",
        quantity: 0.1,
        inventoryItem: { id: "inv-chicken", name: "Chicken", unit: "kg" },
      },
    ],
  },
  {
    id: "ir-cafe-pastry",
    branchId: MOCK_BRANCH_A2,
    name: "Café pastry",
    inclusionType: "MEAL",
    lines: [
      {
        inventoryItemId: "inv-a2-001",
        quantity: 0.05,
        inventoryItem: { id: "inv-a2-001", name: "Café Flour", unit: "kg" },
      },
    ],
  },
  {
    id: "ir-kit",
    branchId: MOCK_BRANCH_A1,
    name: "Standard amenity kit",
    inclusionType: "AMENITY_KIT",
    lines: [
      {
        inventoryItemId: "inv-hk-kit",
        quantity: 1,
        inventoryItem: { id: "inv-hk-kit", name: "Toiletries Kit", unit: "kit" },
      },
    ],
  },
];

const allowancesByReservation: Record<string, MockAllowance[]> = {
  "res-001": [
    {
      id: "ra-breakfast",
      inclusionType: "MEAL",
      inclusionRecipeId: "ir-breakfast",
      recipeName: "Breakfast meal",
      entitledQty: 6,
      consumedQty: 0,
      remainingQty: 6,
      unitLabel: "meals",
    },
    {
      id: "ra-lunch",
      inclusionType: "MEAL",
      inclusionRecipeId: "ir-lunch",
      recipeName: "Lunch meal",
      entitledQty: 6,
      consumedQty: 0,
      remainingQty: 6,
      unitLabel: "meals",
    },
    {
      id: "ra-dinner",
      inclusionType: "MEAL",
      inclusionRecipeId: "ir-dinner",
      recipeName: "Dinner meal",
      entitledQty: 6,
      consumedQty: 0,
      remainingQty: 6,
      unitLabel: "meals",
    },
    {
      id: "ra-kit",
      inclusionType: "AMENITY_KIT",
      inclusionRecipeId: "ir-kit",
      recipeName: "Standard amenity kit",
      entitledQty: 2,
      consumedQty: 2,
      remainingQty: 0,
      unitLabel: "kits",
    },
  ],
};

let packages = structuredClone(INITIAL_PACKAGES) as MockInclusionPackage[];
let recipes = structuredClone(INITIAL_RECIPES) as MockInclusionRecipe[];

export function resetInclusionsState() {
  packages = structuredClone(INITIAL_PACKAGES) as MockInclusionPackage[];
  recipes = structuredClone(INITIAL_RECIPES) as MockInclusionRecipe[];
  for (const key of Object.keys(allowancesByReservation)) {
    if (key === "res-001") {
      allowancesByReservation[key] = structuredClone([
        {
          id: "ra-breakfast",
          inclusionType: "MEAL",
          inclusionRecipeId: "ir-breakfast",
          recipeName: "Breakfast meal",
          entitledQty: 6,
          consumedQty: 0,
          remainingQty: 6,
          unitLabel: "meals",
        },
        {
          id: "ra-lunch",
          inclusionType: "MEAL",
          inclusionRecipeId: "ir-lunch",
          recipeName: "Lunch meal",
          entitledQty: 6,
          consumedQty: 0,
          remainingQty: 6,
          unitLabel: "meals",
        },
        {
          id: "ra-dinner",
          inclusionType: "MEAL",
          inclusionRecipeId: "ir-dinner",
          recipeName: "Dinner meal",
          entitledQty: 6,
          consumedQty: 0,
          remainingQty: 6,
          unitLabel: "meals",
        },
        {
          id: "ra-kit",
          inclusionType: "AMENITY_KIT",
          inclusionRecipeId: "ir-kit",
          recipeName: "Standard amenity kit",
          entitledQty: 2,
          consumedQty: 2,
          remainingQty: 0,
          unitLabel: "kits",
        },
      ]) as MockAllowance[];
    }
  }
}

export function getInclusionPackages(organizationId?: string) {
  const rows = packages.map((p) => ({
    ...p,
    rules: p.rules.map((r) => ({ ...r, recipe: { ...r.recipe } })),
  }));
  if (!organizationId) return rows;
  return rows.filter((p) => p.organizationId === organizationId);
}

export function getInclusionRecipes(branchId?: string) {
  const rows = recipes.map((r) => ({ ...r, lines: r.lines.map((l) => ({ ...l })) }));
  if (!branchId) return rows;
  return rows.filter((r) => r.branchId === branchId);
}

export function getReservationAllowances(reservationId: string) {
  return allowancesByReservation[reservationId] ?? [];
}

export function handleInclusionsMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
  branchId?: string,
  organizationId?: string,
): unknown {
  if (url.includes("/packages")) {
    if (method === "GET") return getInclusionPackages(organizationId);
    if (method === "POST" && body) {
      const pkg: MockInclusionPackage = {
        id: "ipkg-new",
        organizationId: organizationId ?? MOCK_ORG_A,
        name: String(body.name ?? "New package"),
        isDefault: Boolean(body.isDefault),
        isActive: true,
        rules: [],
      };
      packages.push(pkg);
      return pkg;
    }
    return {};
  }

  if (url.includes("/recipes")) {
    if (method === "GET") return getInclusionRecipes(branchId);
    if ((method === "POST" || method === "PUT") && body) {
      const recipe: MockInclusionRecipe = {
        id: "ir-new",
        branchId: branchId ?? MOCK_BRANCH_A1,
        name: String(body.name ?? "Recipe"),
        inclusionType: String(body.inclusionType ?? "MEAL"),
        lines: [],
      };
      recipes.push(recipe);
      return recipe;
    }
    return {};
  }

  const allowanceMatch = url.match(/\/reservations\/([^/?]+)\/allowances/);
  if (allowanceMatch && method === "GET") {
    const resId = allowanceMatch[1];
    const inScope = getPmsReservations(organizationId, branchId).some((r) => r.id === resId);
    if (!inScope) return { status: 404, message: "Reservation not found" };
    return getReservationAllowances(resId);
  }

  const consumeMatch = url.match(/\/reservations\/([^/?]+)\/consume/);
  if (consumeMatch && method === "POST" && body) {
    const resId = consumeMatch[1];
    const inScope = getPmsReservations(organizationId, branchId).some((r) => r.id === resId);
    if (!inScope) return { status: 404, message: "Reservation not found" };
    const list = allowancesByReservation[resId] ?? [];
    const allowance = list.find(
      (a) =>
        a.inclusionRecipeId === body.inclusionRecipeId &&
        a.inclusionType === body.inclusionType,
    );
    const qty = Number(body.quantity ?? 1);
    if (allowance && allowance.consumedQty + qty <= allowance.entitledQty) {
      allowance.consumedQty += qty;
      allowance.remainingQty = allowance.entitledQty - allowance.consumedQty;
    }
    return { id: "ic-new", quantity: qty };
  }

  return {};
}

/** Mutable inclusions state for Playwright route mocks. */

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
    name: "Full board (3 meals)",
    isDefault: true,
    isActive: true,
    rules: [
      {
        id: "ipr-meal",
        inclusionType: "MEAL",
        inclusionRecipeId: "ir-meal",
        quantityPerGuestPerNight: 3,
        quantityPerGuestPerStay: null,
        autoIssueOnCheckIn: false,
        recipe: { id: "ir-meal", name: "Standard guest meal", inclusionType: "MEAL" },
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
    name: "Budget (1 meal)",
    isDefault: false,
    isActive: true,
    rules: [
      {
        id: "ipr-budget",
        inclusionType: "MEAL",
        inclusionRecipeId: "ir-meal",
        quantityPerGuestPerNight: 1,
        quantityPerGuestPerStay: null,
        autoIssueOnCheckIn: false,
        recipe: { id: "ir-meal", name: "Standard guest meal", inclusionType: "MEAL" },
      },
    ],
  },
];

const INITIAL_RECIPES: MockInclusionRecipe[] = [
  {
    id: "ir-meal",
    name: "Standard guest meal",
    inclusionType: "MEAL",
    lines: [
      {
        inventoryItemId: "inv-rice",
        quantity: 0.15,
        inventoryItem: { id: "inv-rice", name: "Rice", unit: "kg" },
      },
    ],
  },
  {
    id: "ir-kit",
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
      id: "ra-meal",
      inclusionType: "MEAL",
      inclusionRecipeId: "ir-meal",
      recipeName: "Standard guest meal",
      entitledQty: 18,
      consumedQty: 0,
      remainingQty: 18,
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
          id: "ra-meal",
          inclusionType: "MEAL",
          inclusionRecipeId: "ir-meal",
          recipeName: "Standard guest meal",
          entitledQty: 18,
          consumedQty: 0,
          remainingQty: 18,
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

export function getInclusionPackages() {
  return packages;
}

export function getInclusionRecipes() {
  return recipes;
}

export function getReservationAllowances(reservationId: string) {
  return allowancesByReservation[reservationId] ?? [];
}

export function handleInclusionsMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  if (url.includes("/packages")) {
    if (method === "GET") return packages;
    if (method === "POST" && body) {
      const pkg: MockInclusionPackage = {
        id: "ipkg-new",
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
    if (method === "GET") return recipes;
    if ((method === "POST" || method === "PUT") && body) {
      const recipe: MockInclusionRecipe = {
        id: "ir-new",
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
    return getReservationAllowances(allowanceMatch[1]);
  }

  const consumeMatch = url.match(/\/reservations\/([^/?]+)\/consume/);
  if (consumeMatch && method === "POST" && body) {
    const resId = consumeMatch[1];
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

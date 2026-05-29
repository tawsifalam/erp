type MockInventoryItem = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  lowStockThreshold?: number | null;
  currentStock: number;
};

type MockMovement = {
  id: string;
  itemId: string;
  direction: "IN" | "OUT";
  movementType: string;
  quantity: string;
  notes?: string;
  createdAt: string;
};

const INITIAL_ITEMS: MockInventoryItem[] = [
  {
    id: "inv-001",
    name: "Basmati Rice",
    sku: "RICE-BAS-25",
    unit: "kg",
    lowStockThreshold: 50,
    currentStock: 120,
  },
  {
    id: "inv-002",
    name: "Olive Oil",
    sku: "OIL-OLV-5L",
    unit: "litre",
    lowStockThreshold: 10,
    currentStock: 34,
  },
  {
    id: "inv-003",
    name: "Chicken Breast",
    sku: "MEAT-CHK-01",
    unit: "kg",
    lowStockThreshold: 20,
    currentStock: 45,
  },
];

let items = structuredClone(INITIAL_ITEMS) as MockInventoryItem[];
const movements: MockMovement[] = [];

export function resetInventoryState() {
  items = structuredClone(INITIAL_ITEMS) as MockInventoryItem[];
  movements.length = 0;
}

export function getInventoryItems() {
  return items.map((i) => ({ ...i }));
}

export function handleInventoryItemMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  const idMatch = url.match(/\/items\/([^/?]+)/);
  const id = idMatch?.[1];

  if (method === "GET" && !id) {
    return getInventoryItems();
  }

  if (method === "POST" && !id) {
    const item: MockInventoryItem = {
      id: "inv_new",
      name: String(body?.name ?? "New Item"),
      sku: String(body?.sku ?? "SKU-NEW"),
      unit: String(body?.unit ?? "unit"),
      lowStockThreshold:
        body?.lowStockThreshold != null ? Number(body.lowStockThreshold) : null,
      currentStock: 0,
    };
    items.push(item);
    return item;
  }

  if (!id) return {};

  const item = items.find((i) => i.id === id);
  if (!item) return {};

  if (method === "PATCH" && body) {
    if (body.name) item.name = String(body.name);
    if (body.unit) item.unit = String(body.unit);
    if (body.lowStockThreshold !== undefined) {
      item.lowStockThreshold =
        body.lowStockThreshold == null ? null : Number(body.lowStockThreshold);
    }
    return item;
  }

  return item;
}

export function handleInventoryMovementMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  const idMatch = url.match(/\/items\/([^/?]+)\/movements/);
  const itemId = idMatch?.[1];

  if (method === "GET" && itemId) {
    return movements.filter((m) => m.itemId === itemId);
  }

  if (method === "POST" && url.includes("/movements") && body) {
    const item = items.find((i) => i.id === String(body.itemId));
    const qty = Number(body.quantity);
    const movementType = String(body.movementType ?? "PURCHASE");
    let direction: "IN" | "OUT" = "IN";
    if (movementType === "PURCHASE") direction = "IN";
    else if (movementType === "ADJUSTMENT") {
      direction = body.direction === "OUT" ? "OUT" : "IN";
    } else {
      direction = "OUT";
    }

    const mov: MockMovement = {
      id: `mov_${movements.length + 1}`,
      itemId: String(body.itemId),
      direction,
      movementType,
      quantity: String(qty),
      notes: body.notes ? String(body.notes) : undefined,
      createdAt: new Date().toISOString(),
    };
    movements.push(mov);

    if (item) {
      item.currentStock += direction === "IN" ? qty : -qty;
    }
    return mov;
  }

  return [];
}

type MockPool = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
};

type MockInventoryItem = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  lowStockThreshold?: number | null;
  currentStock: number;
  pool: { id: string; code: string; name: string };
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

const INITIAL_POOLS: MockPool[] = [
  {
    id: "ivp-guest",
    code: "guest",
    name: "Guest / Kitchen",
    isActive: true,
    isSystem: true,
    sortOrder: 0,
  },
  {
    id: "ivp-staff",
    code: "staff",
    name: "Staff pantry",
    isActive: true,
    isSystem: true,
    sortOrder: 1,
  },
];

const guestPool = { id: "ivp-guest", code: "guest", name: "Guest / Kitchen" };
const staffPool = { id: "ivp-staff", code: "staff", name: "Staff pantry" };

const INITIAL_ITEMS: MockInventoryItem[] = [
  {
    id: "inv-001",
    name: "Basmati Rice",
    sku: "RICE-BAS-25",
    unit: "kg",
    lowStockThreshold: 50,
    currentStock: 120,
    pool: guestPool,
  },
  {
    id: "inv-002",
    name: "Olive Oil",
    sku: "OIL-OLV-5L",
    unit: "litre",
    lowStockThreshold: 10,
    currentStock: 34,
    pool: guestPool,
  },
  {
    id: "inv-003",
    name: "Chicken Breast",
    sku: "MEAT-CHK-01",
    unit: "kg",
    lowStockThreshold: 20,
    currentStock: 45,
    pool: guestPool,
  },
  {
    id: "inv-staff-001",
    name: "Staff Lunch Rice",
    sku: "STAFF-RICE",
    unit: "kg",
    lowStockThreshold: 5,
    currentStock: 20,
    pool: staffPool,
  },
];

let pools = structuredClone(INITIAL_POOLS) as MockPool[];
let items = structuredClone(INITIAL_ITEMS) as MockInventoryItem[];
const movements: MockMovement[] = [];

export function resetInventoryState() {
  pools = structuredClone(INITIAL_POOLS) as MockPool[];
  items = structuredClone(INITIAL_ITEMS) as MockInventoryItem[];
  movements.length = 0;
}

export function getInventoryItems() {
  return items.map((i) => ({ ...i }));
}

export function getInventoryPools() {
  return pools.map((p) => ({ ...p }));
}

function poolFromUrl(url: string) {
  try {
    const q = new URL(url).searchParams.get("pool");
    return q || "";
  } catch {
    return "";
  }
}

export function handleInventoryPoolMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  if (method === "GET") {
    const activeOnly = url.includes("activeOnly=true");
    return getInventoryPools().filter((p) => !activeOnly || p.isActive);
  }
  if (method === "POST") {
    const pool: MockPool = {
      id: `ivp_${pools.length + 1}`,
      code: String(body?.code ?? "custom").toLowerCase(),
      name: String(body?.name ?? "Custom pool"),
      isActive: true,
      isSystem: false,
      sortOrder: pools.length,
    };
    pools.push(pool);
    return pool;
  }
  const idMatch = url.match(/\/pools\/([^/?]+)/);
  const id = idMatch?.[1];
  if (method === "PATCH" && id) {
    const pool = pools.find((p) => p.id === id);
    if (!pool) return {};
    if (body?.name) pool.name = String(body.name);
    if (body?.isActive !== undefined) pool.isActive = Boolean(body.isActive);
    return pool;
  }
  return {};
}

export function handleInventoryItemMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  const idMatch = url.match(/\/items\/([^/?]+)/);
  const id = idMatch?.[1];

  if (method === "GET" && !id) {
    const poolCode = poolFromUrl(url);
    const all = getInventoryItems();
    return poolCode ? all.filter((i) => i.pool.code === poolCode) : all;
  }

  if (method === "POST" && !id) {
    const poolId = String(body?.poolId ?? guestPool.id);
    const pool = pools.find((p) => p.id === poolId) ?? guestPool;
    const item: MockInventoryItem = {
      id: "inv_new",
      name: String(body?.name ?? "New Item"),
      sku: String(body?.sku ?? "SKU-NEW"),
      unit: String(body?.unit ?? "unit"),
      lowStockThreshold:
        body?.lowStockThreshold != null ? Number(body.lowStockThreshold) : null,
      currentStock: 0,
      pool: { id: pool.id, code: pool.code, name: pool.name },
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

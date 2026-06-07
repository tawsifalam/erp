/** Mutable POS state for Playwright route mocks (reset via resetPosState). */

import { recordAudit } from "./audit-state";

const MOCK_BRANCH_A1 = "branch-test-001";
const MOCK_BRANCH_A2 = "branch-test-002";

export type MockMenuItem = {
  id: string;
  name: string;
  price: string;
  isActive?: boolean;
};

export type MockMenuCategory = {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
  items: MockMenuItem[];
};

export type MockOrderLine = {
  id: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  menuItemId: string;
  menuItem: { name: string; id?: string };
};

export type MockOrder = {
  id: string;
  branchId: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  paidAmount: string;
  tableNumber?: string;
  notes?: string;
  createdAt: string;
  lines: MockOrderLine[];
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const INITIAL_CATEGORIES: MockMenuCategory[] = [
  {
    id: "mc_001",
    branchId: MOCK_BRANCH_A1,
    name: "Mains",
    sortOrder: 1,
    items: [
      { id: "mi_001", name: "Chicken Biryani", price: "320" },
      { id: "mi_002", name: "Grilled Fish", price: "450" },
    ],
  },
  {
    id: "mc_002",
    branchId: MOCK_BRANCH_A1,
    name: "Beverages",
    sortOrder: 2,
    items: [{ id: "mi_003", name: "Tea", price: "50" }],
  },
  {
    id: "mc_a2_001",
    branchId: MOCK_BRANCH_A2,
    name: "Café bites",
    sortOrder: 1,
    items: [{ id: "mi_a2_001", name: "Croissant", price: "120" }],
  },
];

const INITIAL_ORDERS: MockOrder[] = [
  {
    id: "ord_draft",
    branchId: MOCK_BRANCH_A1,
    status: "DRAFT",
    paymentStatus: "UNPAID",
    totalAmount: "320",
    paidAmount: "0",
    tableNumber: "T-1",
    createdAt: new Date().toISOString(),
    lines: [
      {
        id: "ol_1",
        quantity: 1,
        unitPrice: "320",
        lineTotal: "320",
        menuItemId: "mi_001",
        menuItem: { name: "Chicken Biryani", id: "mi_001" },
      },
    ],
  },
  {
    id: "ord_001",
    branchId: MOCK_BRANCH_A1,
    status: "SUBMITTED",
    paymentStatus: "UNPAID",
    totalAmount: "640",
    paidAmount: "0",
    tableNumber: "T-3",
    createdAt: new Date().toISOString(),
    lines: [
      {
        id: "ol_2",
        quantity: 2,
        unitPrice: "320",
        lineTotal: "640",
        menuItemId: "mi_001",
        menuItem: { name: "Chicken Biryani", id: "mi_001" },
      },
    ],
  },
  {
    id: "ord_cancelled",
    branchId: MOCK_BRANCH_A1,
    status: "CANCELLED",
    paymentStatus: "UNPAID",
    totalAmount: "50",
    paidAmount: "0",
    tableNumber: "T-9",
    createdAt: new Date().toISOString(),
    lines: [
      {
        id: "ol_4",
        quantity: 1,
        unitPrice: "50",
        lineTotal: "50",
        menuItemId: "mi_003",
        menuItem: { name: "Tea", id: "mi_003" },
      },
    ],
  },
  {
    id: "ord_a2_001",
    branchId: MOCK_BRANCH_A2,
    status: "SUBMITTED",
    paymentStatus: "UNPAID",
    totalAmount: "120",
    paidAmount: "0",
    tableNumber: "C-2",
    createdAt: new Date().toISOString(),
    lines: [
      {
        id: "ol_a2_1",
        quantity: 1,
        unitPrice: "120",
        lineTotal: "120",
        menuItemId: "mi_a2_001",
        menuItem: { name: "Croissant", id: "mi_a2_001" },
      },
    ],
  },
  {
    id: "ord_002",
    branchId: MOCK_BRANCH_A1,
    status: "COMPLETED",
    paymentStatus: "PAID",
    totalAmount: "870",
    paidAmount: "870",
    tableNumber: "T-7",
    createdAt: new Date().toISOString(),
    lines: [
      {
        id: "ol_3",
        quantity: 1,
        unitPrice: "50",
        lineTotal: "50",
        menuItemId: "mi_003",
        menuItem: { name: "Tea", id: "mi_003" },
      },
    ],
  },
];

let categories = clone(INITIAL_CATEGORIES);
let orders = clone(INITIAL_ORDERS);

export function resetPosState() {
  categories = clone(INITIAL_CATEGORIES);
  orders = clone(INITIAL_ORDERS);
}

export function getPosCategories(branchId?: string) {
  const rows = categories.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i })) }));
  if (!branchId) return rows;
  return rows.filter((c) => c.branchId === branchId);
}

export function getPosOrders(branchId?: string) {
  const rows = orders.map((o) => ({ ...o, lines: o.lines.map((l) => ({ ...l })) }));
  if (!branchId) return rows;
  return rows.filter((o) => o.branchId === branchId);
}

export function handlePosCategoryMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
  branchId?: string,
): unknown {
  const idMatch = url.match(/\/categories\/([^/?]+)/);
  const id = idMatch?.[1];

  if (method === "POST") {
    const cat: MockMenuCategory = {
      id: "mc_new",
      branchId: branchId ?? MOCK_BRANCH_A1,
      name: String(body?.name ?? "New Category"),
      sortOrder: Number(body?.sortOrder ?? 0),
      items: [],
    };
    categories.push(cat);
    return cat;
  }

  if (!id) return {};

  if (method === "DELETE") {
    const idx = categories.findIndex((c) => c.id === id);
    if (idx >= 0) categories.splice(idx, 1);
    return { id };
  }

  const cat = categories.find((c) => c.id === id);
  if (!cat) return {};

  if (method === "PATCH" && body) {
    if (body.name) cat.name = String(body.name);
    if (body.sortOrder != null) cat.sortOrder = Number(body.sortOrder);
  }

  return cat;
}

function categoryInBranch(categoryId: string, branchId?: string) {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return null;
  if (branchId && cat.branchId !== branchId) return null;
  return cat;
}

export function handlePosMenuItemMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
  branchId?: string,
): unknown {
  const idMatch = url.match(/\/items\/([^/?]+)/);
  const id = idMatch?.[1];

  if (method === "POST") {
    const categoryId = String(body?.categoryId ?? "");
    const cat = categoryInBranch(categoryId, branchId);
    if (!cat) return { status: 404, message: "Category not found" };
    const item: MockMenuItem = {
      id: "mi_new",
      name: String(body?.name ?? "New Item"),
      price: String(body?.price ?? "0"),
    };
    cat.items.push(item);
    return { ...item, categoryId };
  }

  if (!id) return {};

  if (method === "DELETE") {
    for (const cat of categories) {
      if (branchId && cat.branchId !== branchId) continue;
      const idx = cat.items.findIndex((i) => i.id === id);
      if (idx >= 0) {
        cat.items.splice(idx, 1);
        return { id };
      }
    }
    return { status: 404, message: "Menu item not found" };
  }

  for (const cat of categories) {
    if (branchId && cat.branchId !== branchId) continue;
    const item = cat.items.find((i) => i.id === id);
    if (item && method === "PATCH" && body) {
      if (body.name) item.name = String(body.name);
      if (body.price != null) item.price = String(body.price);
      if (body.isActive !== undefined) item.isActive = Boolean(body.isActive);
      return item;
    }
  }

  return { status: 404, message: "Menu item not found" };
}

export function handlePosOrderMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
  branchId?: string,
): unknown {
  const idMatch = url.match(/\/orders\/([^/?]+)/);
  const id = idMatch?.[1];

  if (method === "POST" && !id) {
    const lines = (body?.lines as { menuItemId: string; quantity: number; unitPrice: number }[]) ?? [];
    const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const order: MockOrder = {
      id: "ord_new",
      branchId: branchId ?? MOCK_BRANCH_A1,
      status: "DRAFT",
      paymentStatus: "UNPAID",
      totalAmount: String(total),
      paidAmount: "0",
      tableNumber: body?.tableNumber ? String(body.tableNumber) : undefined,
      notes: body?.notes ? String(body.notes) : undefined,
      createdAt: new Date().toISOString(),
      lines: lines.map((l, i) => ({
        id: `ol_new_${i}`,
        quantity: l.quantity,
        unitPrice: String(l.unitPrice),
        lineTotal: String(l.quantity * l.unitPrice),
        menuItemId: l.menuItemId,
        menuItem: { name: "Item", id: l.menuItemId },
      })),
    };
    orders.unshift(order);
    return order;
  }

  if (!id) return {};

  const order = orders.find((o) => o.id === id);
  if (!order) return {};

  if (url.includes("/submit")) {
    order.status = "SUBMITTED";
    return { order, ticket: { id: "kt_new", orderId: id, status: "SUBMITTED" } };
  }

  if (url.includes("/complete")) {
    const paid = body?.paidAmount != null ? Number(body.paidAmount) : Number(order.totalAmount);
    order.status = "COMPLETED";
    order.paidAmount = String(paid);
    order.paymentStatus =
      paid >= Number(order.totalAmount) ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
    recordAudit({
      action: "UPDATE",
      entityType: "order",
      entityId: id,
      metadata: { status: "COMPLETED", paidAmount: paid },
    });
    return order;
  }

  if (method === "DELETE") {
    const idx = orders.findIndex((o) => o.id === id);
    if (idx >= 0) orders.splice(idx, 1);
    return { id };
  }

  if (url.includes("/cancel")) {
    order.status = "CANCELLED";
    recordAudit({
      action: "UPDATE",
      entityType: "order",
      entityId: id,
      metadata: { status: "CANCELLED" },
    });
    return order;
  }

  if (method === "PATCH" && body?.status) {
    order.status = String(body.status);
    return order;
  }

  return order;
}

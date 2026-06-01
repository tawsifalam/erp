/** Mutable procurement state for Playwright route mocks. */

import { recordAudit } from "./audit-state";
import { getInventoryItems } from "./inventory-state";

export type MockVendor = {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  isActive: boolean;
};

export type MockPoLine = {
  id: string;
  purchaseOrderId: string;
  inventoryItemId: string;
  quantity: string;
  unitPrice: string;
  receivedQty: string;
  inventoryItem: { id: string; sku: string; name: string };
};

export type MockPurchaseOrder = {
  id: string;
  status: string;
  vendorId: string;
  vendor: { id: string; name: string };
  lines: MockPoLine[];
};

const INITIAL_VENDORS: MockVendor[] = [
  {
    id: "ven_001",
    name: "Fresh Foods Ltd",
    contactName: "Rashid",
    email: "orders@freshfoods.example",
    isActive: true,
  },
];

let vendors = structuredClone(INITIAL_VENDORS) as MockVendor[];
let purchaseOrders: MockPurchaseOrder[] = [];

export function resetProcurementState() {
  vendors = structuredClone(INITIAL_VENDORS) as MockVendor[];
  purchaseOrders = [];
}

export function getProcurementVendors() {
  return vendors.map((v) => ({ ...v }));
}

export function getProcurementPurchaseOrders() {
  return purchaseOrders.map((po) => ({
    ...po,
    lines: po.lines.map((l) => ({ ...l, inventoryItem: { ...l.inventoryItem } })),
  }));
}

export function handleProcurementMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  if (method === "GET" && url.includes("/vendors")) {
    return getProcurementVendors();
  }

  if (method === "POST" && url.includes("/vendors")) {
    const vendor: MockVendor = {
      id: `ven_${vendors.length + 1}`,
      name: String(body?.name ?? "New vendor"),
      contactName: body?.contactName ? String(body.contactName) : null,
      email: body?.email ? String(body.email) : null,
      isActive: true,
    };
    vendors.push(vendor);
    recordAudit({
      action: "CREATE",
      entityType: "vendor",
      entityId: vendor.id,
      metadata: { name: vendor.name },
    });
    return vendor;
  }

  if (method === "GET" && url.includes("/purchase-orders") && !url.includes("/submit") && !url.includes("/receive")) {
    return getProcurementPurchaseOrders();
  }

  const poIdMatch = url.match(/\/purchase-orders\/([^/]+)/);
  const poId = poIdMatch?.[1];

  if (method === "POST" && url.includes("/purchase-orders") && !url.includes("/submit") && !url.includes("/receive")) {
    const itemId = String(body?.lines && Array.isArray(body.lines) ? (body.lines[0] as { inventoryItemId: string }).inventoryItemId : "");
    const item = getInventoryItems().find((i) => i.id === itemId);
    const lineId = `pol_${purchaseOrders.length + 1}`;
    const po: MockPurchaseOrder = {
      id: `po_${purchaseOrders.length + 1}`,
      status: "DRAFT",
      vendorId: String(body?.vendorId ?? ""),
      vendor: vendors.find((v) => v.id === body?.vendorId) ?? { id: "", name: "Unknown" },
      lines: [
        {
          id: lineId,
          purchaseOrderId: `po_${purchaseOrders.length + 1}`,
          inventoryItemId: itemId,
          quantity: String((body?.lines as { quantity: number }[])?.[0]?.quantity ?? 0),
          unitPrice: String((body?.lines as { unitPrice: number }[])?.[0]?.unitPrice ?? 0),
          receivedQty: "0",
          inventoryItem: item
            ? { id: item.id, sku: item.sku, name: item.name }
            : { id: itemId, sku: "SKU", name: "Item" },
        },
      ],
    };
    po.lines[0].purchaseOrderId = po.id;
    purchaseOrders.push(po);
    recordAudit({
      action: "CREATE",
      entityType: "purchase_order",
      entityId: po.id,
    });
    return po;
  }

  if (method === "POST" && poId && url.includes("/submit")) {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return { status: 404, message: "PO not found" };
    po.status = "SUBMITTED";
    recordAudit({ action: "SUBMIT", entityType: "purchase_order", entityId: poId });
    return { ...po, status: "SUBMITTED" };
  }

  if (method === "POST" && poId && url.includes("/receive") && body) {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return { status: 404, message: "PO not found" };
    const lineId = String(body.purchaseOrderLineId);
    const line = po.lines.find((l) => l.id === lineId);
    if (!line) return { status: 404, message: "Line not found" };
    const qty = Number(body.quantity);
    line.receivedQty = String(Number(line.receivedQty) + qty);
    const ordered = Number(line.quantity);
    const received = Number(line.receivedQty);
    po.status = received >= ordered ? "RECEIVED" : "PARTIALLY_RECEIVED";
    recordAudit({
      action: "RECEIVE",
      entityType: "goods_receipt",
      entityId: `gr_${poId}`,
      metadata: { purchaseOrderId: poId, quantity: qty },
    });
    return { id: `gr_${poId}`, purchaseOrderId: poId, quantity: qty };
  }

  return {};
}

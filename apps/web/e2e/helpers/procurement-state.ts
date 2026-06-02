/** Mutable procurement state for Playwright route mocks. */

import { recordAudit } from "./audit-state";
import { recordVendorPaymentJournal } from "./accounting-state";
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

type MockVendorPayment = {
  id: string;
  amount: string;
  paymentDate: string;
  payFromAccountCode: string;
  reference: string | null;
  vendor: { name: string };
  purchaseOrder: { id: string; status: string } | null;
};

let vendors = structuredClone(INITIAL_VENDORS) as MockVendor[];
let purchaseOrders: MockPurchaseOrder[] = [];
let vendorPayments: MockVendorPayment[] = [];

function computeVendorAp(vendorId: string) {
  let accrued = 0;
  for (const po of purchaseOrders) {
    if (po.vendorId !== vendorId) continue;
    for (const line of po.lines) {
      accrued += Number(line.receivedQty) * Number(line.unitPrice);
    }
  }
  const paid = vendorPayments
    .filter((p) => p.vendor.name === vendors.find((v) => v.id === vendorId)?.name)
    .reduce((s, p) => s + Number(p.amount), 0);
  const balance = Math.round((accrued - paid) * 100) / 100;
  return {
    accrued: Math.round(accrued * 100) / 100,
    paid: Math.round(paid * 100) / 100,
    balance,
  };
}

export function resetProcurementState() {
  vendors = structuredClone(INITIAL_VENDORS) as MockVendor[];
  purchaseOrders = [];
  vendorPayments = [];
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
  if (method === "GET" && url.includes("/vendor-payments")) {
    return vendorPayments.map((p) => ({ ...p }));
  }

  if (method === "GET" && url.match(/\/vendors\/[^/]+\/ap-balance/)) {
    const vendorId = url.match(/\/vendors\/([^/]+)\/ap-balance/)?.[1];
    if (!vendorId) return { status: 404, message: "Vendor not found" };
    return computeVendorAp(vendorId);
  }

  if (method === "POST" && url.includes("/vendor-payments")) {
    const vendorId = String(body?.vendorId ?? "");
    const vendor = vendors.find((v) => v.id === vendorId);
    if (!vendor) return { status: 404, message: "Vendor not found" };
    const amount = Number(body?.amount ?? 0);
    if (amount <= 0) return { status: 400, message: "amount must be positive" };
    const bal = computeVendorAp(vendorId);
    if (amount > bal.balance) {
      return {
        status: 400,
        message: `Payment ${amount} exceeds outstanding AP balance ${bal.balance} for this vendor`,
      };
    }
    const payment: MockVendorPayment = {
      id: `vp_${vendorPayments.length + 1}`,
      amount: String(amount),
      paymentDate: body?.paymentDate
        ? new Date(String(body.paymentDate)).toISOString()
        : new Date().toISOString(),
      payFromAccountCode: String(body?.payFromAccountCode ?? "1100"),
      reference: body?.reference ? String(body.reference) : null,
      vendor: { name: vendor.name },
      purchaseOrder: body?.purchaseOrderId
        ? { id: String(body.purchaseOrderId), status: "RECEIVED" }
        : null,
    };
    vendorPayments.unshift(payment);
    recordVendorPaymentJournal(vendor.name, amount);
    recordAudit({
      action: "CREATE",
      entityType: "vendor_payment",
      entityId: payment.id,
      metadata: { vendorId, amount },
    });
    return payment;
  }

  if (method === "GET" && url.includes("/vendors") && !url.includes("/ap-balance")) {
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

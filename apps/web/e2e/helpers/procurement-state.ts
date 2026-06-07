/** Mutable procurement state for Playwright route mocks. */

import { recordAudit } from "./audit-state";
import { recordVendorPaymentJournal } from "./accounting-state";
import { getInventoryItems } from "./inventory-state";

const MOCK_ORG_A = "org-test-001";
const MOCK_ORG_B = "org-test-002";
const MOCK_BRANCH_A1 = "branch-test-001";
const MOCK_BRANCH_A2 = "branch-test-002";

export type MockVendor = {
  id: string;
  organizationId: string;
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
  branchId: string;
  status: string;
  vendorId: string;
  vendor: { id: string; name: string };
  lines: MockPoLine[];
};

const INITIAL_VENDORS: MockVendor[] = [
  {
    id: "ven_001",
    organizationId: MOCK_ORG_A,
    name: "Fresh Foods Ltd",
    contactName: "Rashid",
    email: "orders@freshfoods.example",
    isActive: true,
  },
  {
    id: "ven_b_001",
    organizationId: MOCK_ORG_B,
    name: "Harbor Provisions",
    contactName: "Samira",
    email: "orders@harbor.example",
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

export function getProcurementVendors(organizationId?: string) {
  const rows = vendors.map((v) => ({ ...v }));
  if (!organizationId) return rows;
  return rows.filter((v) => v.organizationId === organizationId);
}

export function getProcurementPurchaseOrders(branchId?: string) {
  let rows = purchaseOrders;
  if (branchId) rows = rows.filter((po) => po.branchId === branchId);
  return rows.map((po) => ({
    ...po,
    lines: po.lines.map((l) => ({ ...l, inventoryItem: { ...l.inventoryItem } })),
  }));
}

function findVendorInOrg(vendorId: string, organizationId?: string) {
  const vendor = vendors.find((v) => v.id === vendorId);
  if (!vendor) return null;
  if (organizationId && vendor.organizationId !== organizationId) return null;
  return vendor;
}

function findPoInBranch(poId: string, branchId?: string) {
  const po = purchaseOrders.find((p) => p.id === poId);
  if (!po) return null;
  if (branchId && po.branchId !== branchId) return null;
  return po;
}

export function handleProcurementMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
  organizationId?: string,
  branchId?: string,
): unknown {
  if (method === "GET" && url.includes("/vendor-payments")) {
    return vendorPayments.map((p) => ({ ...p }));
  }

  if (method === "GET" && url.match(/\/vendors\/[^/]+\/ap-balance/)) {
    const vendorId = url.match(/\/vendors\/([^/]+)\/ap-balance/)?.[1];
    if (!vendorId || !findVendorInOrg(vendorId, organizationId)) {
      return { status: 404, message: "Vendor not found" };
    }
    return computeVendorAp(vendorId);
  }

  if (method === "POST" && url.includes("/vendor-payments")) {
    const vendorId = String(body?.vendorId ?? "");
    const vendor = findVendorInOrg(vendorId, organizationId);
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
    recordVendorPaymentJournal(vendor.name, amount, vendor.organizationId);
    recordAudit({
      action: "CREATE",
      entityType: "vendor_payment",
      entityId: payment.id,
      metadata: { vendorId, amount },
    });
    return payment;
  }

  if (method === "GET" && url.includes("/vendors") && !url.includes("/ap-balance")) {
    return getProcurementVendors(organizationId);
  }

  if (method === "POST" && url.includes("/vendors")) {
    const vendor: MockVendor = {
      id: `ven_${vendors.length + 1}`,
      organizationId: organizationId ?? MOCK_ORG_A,
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
    return getProcurementPurchaseOrders(branchId);
  }

  const poIdMatch = url.match(/\/purchase-orders\/([^/]+)/);
  const poId = poIdMatch?.[1];

  if (method === "POST" && url.includes("/purchase-orders") && !url.includes("/submit") && !url.includes("/receive")) {
    const vendorId = String(body?.vendorId ?? "");
    const vendor = findVendorInOrg(vendorId, organizationId);
    if (!vendor) return { status: 404, message: "Vendor not found" };
    const itemId = String(body?.lines && Array.isArray(body.lines) ? (body.lines[0] as { inventoryItemId: string }).inventoryItemId : "");
    const item = getInventoryItems(branchId).find((i) => i.id === itemId);
    if (!item) return { status: 404, message: "Inventory item not found" };
    const lineId = `pol_${purchaseOrders.length + 1}`;
    const po: MockPurchaseOrder = {
      id: `po_${purchaseOrders.length + 1}`,
      branchId: branchId ?? MOCK_BRANCH_A1,
      status: "DRAFT",
      vendorId,
      vendor: { id: vendor.id, name: vendor.name },
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
    const po = findPoInBranch(poId, branchId);
    if (!po) return { status: 404, message: "PO not found" };
    po.status = "SUBMITTED";
    recordAudit({ action: "SUBMIT", entityType: "purchase_order", entityId: poId });
    return { ...po, status: "SUBMITTED" };
  }

  if (method === "POST" && poId && url.includes("/receive") && body) {
    const po = findPoInBranch(poId, branchId);
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

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MovementType } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { AccountingListenersService } from "../accounting/accounting-listeners.service";
import { generatePrefixedId, roundMoney, toNumber } from "@erp/utils";
import {
  PO_RECEIVABLE_STATUSES,
  PO_STATUS_DRAFT,
  PO_STATUS_PARTIALLY_RECEIVED,
  PO_STATUS_RECEIVED,
  PO_STATUS_SUBMITTED,
} from "./procurement.constants";

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly accounting: AccountingListenersService,
  ) {}

  listVendors(organizationId: string) {
    return this.prisma.vendor.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  createVendor(
    organizationId: string,
    data: {
      name: string;
      contactName?: string;
      email?: string;
      phone?: string;
      paymentTerms?: string;
    },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("Vendor name is required");
    return this.prisma.vendor.create({
      data: {
        id: generatePrefixedId("ven"),
        organizationId,
        name: data.name.trim(),
        contactName: data.contactName?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        paymentTerms: data.paymentTerms?.trim() || null,
      },
    });
  }

  async updateVendor(
    organizationId: string,
    vendorId: string,
    data: {
      name?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      paymentTerms?: string;
      isActive?: boolean;
    },
  ) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, organizationId },
    });
    if (!vendor) throw new NotFoundException("Vendor not found");

    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.contactName !== undefined
          ? { contactName: data.contactName?.trim() || null }
          : {}),
        ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(data.paymentTerms !== undefined
          ? { paymentTerms: data.paymentTerms?.trim() || null }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  listPurchaseOrders(branchId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { branchId },
      include: {
        vendor: { select: { id: true, name: true } },
        lines: { include: { inventoryItem: { select: { id: true, sku: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getPurchaseOrder(branchId: string, purchaseOrderId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, branchId },
      include: {
        vendor: true,
        lines: { include: { inventoryItem: true } },
        receipts: true,
      },
    });
    if (!po) throw new NotFoundException("Purchase order not found");
    return po;
  }

  async createPurchaseOrder(params: {
    organizationId: string;
    branchId: string;
    vendorId: string;
    expectedDate?: string;
    notes?: string;
    lines: { inventoryItemId: string; quantity: number; unitPrice: number }[];
  }) {
    if (!params.lines.length) {
      throw new BadRequestException("At least one line is required");
    }

    const vendor = await this.prisma.vendor.findFirst({
      where: { id: params.vendorId, organizationId: params.organizationId, isActive: true },
    });
    if (!vendor) throw new NotFoundException("Vendor not found");

    for (const line of params.lines) {
      if (line.quantity <= 0 || line.unitPrice < 0) {
        throw new BadRequestException("Line quantity and unit price must be valid");
      }
      await this.inventory.getItem(params.branchId, line.inventoryItemId);
    }

    return this.prisma.purchaseOrder.create({
      data: {
        id: generatePrefixedId("po"),
        organizationId: params.organizationId,
        branchId: params.branchId,
        vendorId: params.vendorId,
        status: PO_STATUS_DRAFT,
        expectedDate: params.expectedDate ? new Date(params.expectedDate) : null,
        notes: params.notes?.trim() || null,
        lines: {
          create: params.lines.map((line) => ({
            id: generatePrefixedId("pol"),
            inventoryItemId: line.inventoryItemId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          })),
        },
      },
      include: {
        vendor: { select: { id: true, name: true } },
        lines: { include: { inventoryItem: true } },
      },
    });
  }

  async submitPurchaseOrder(branchId: string, purchaseOrderId: string) {
    const po = await this.getPurchaseOrder(branchId, purchaseOrderId);
    if (po.status !== PO_STATUS_DRAFT) {
      throw new BadRequestException("Only draft purchase orders can be submitted");
    }
    return this.prisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: PO_STATUS_SUBMITTED },
    });
  }

  async receiveGoods(params: {
    organizationId: string;
    branchId: string;
    purchaseOrderId: string;
    purchaseOrderLineId: string;
    quantity: number;
  }) {
    if (params.quantity <= 0) {
      throw new BadRequestException("quantity must be positive");
    }

    const po = await this.getPurchaseOrder(params.branchId, params.purchaseOrderId);
    if (!PO_RECEIVABLE_STATUSES.has(po.status)) {
      throw new BadRequestException("Purchase order is not open for receiving");
    }

    const line = po.lines.find((l) => l.id === params.purchaseOrderLineId);
    if (!line) throw new NotFoundException("Purchase order line not found");

    const ordered = toNumber(line.quantity);
    const received = toNumber(line.receivedQty);
    const remaining = ordered - received;
    if (params.quantity > remaining) {
      throw new BadRequestException(`Cannot receive more than ${remaining} remaining`);
    }

    const unitPrice = toNumber(line.unitPrice);
    const movement = await this.inventory.createMovement({
      itemId: line.inventoryItemId,
      branchId: params.branchId,
      movementType: MovementType.PURCHASE,
      quantity: params.quantity,
      unitCost: unitPrice,
      referenceType: "PurchaseOrder",
      referenceId: po.id,
    });

    const receipt = await this.prisma.goodsReceipt.create({
      data: {
        id: generatePrefixedId("gr"),
        purchaseOrderId: po.id,
        purchaseOrderLineId: line.id,
        inventoryMovementId: movement.id,
        quantity: params.quantity,
      },
    });

    const newReceived = received + params.quantity;
    await this.prisma.purchaseOrderLine.update({
      where: { id: line.id },
      data: { receivedQty: newReceived },
    });

    const updatedLines = await this.prisma.purchaseOrderLine.findMany({
      where: { purchaseOrderId: po.id },
    });
    const allReceived = updatedLines.every(
      (l) => toNumber(l.receivedQty) >= toNumber(l.quantity),
    );
    const anyReceived = updatedLines.some((l) => toNumber(l.receivedQty) > 0);

    await this.prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: allReceived
          ? PO_STATUS_RECEIVED
          : anyReceived
            ? PO_STATUS_PARTIALLY_RECEIVED
            : po.status,
      },
    });

    const amount = roundMoney(params.quantity * unitPrice);
    await this.accounting.postGoodsReceipt(params.organizationId, receipt.id, amount);

    return receipt;
  }
}

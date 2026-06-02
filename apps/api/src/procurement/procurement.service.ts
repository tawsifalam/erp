import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MovementType } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { AccountingListenersService } from "../accounting/accounting-listeners.service";
import { AuditAction, AuditEntityType } from "../audit/audit.constants";
import { AuditService } from "../audit/audit.service";
import { generatePrefixedId, roundMoney, toNumber } from "@erp/utils";
import {
  PO_RECEIVABLE_STATUSES,
  PO_STATUS_DRAFT,
  PO_STATUS_PARTIALLY_RECEIVED,
  PO_STATUS_RECEIVED,
  PO_STATUS_SUBMITTED,
} from "./procurement.constants";
import { PAY_FROM_ACCOUNT_CODES } from "./vendor-payment.constants";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "../notifications/notifications.constants";
import { Role } from "@erp/types";

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly accounting: AccountingListenersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  listVendors(organizationId: string) {
    return this.prisma.vendor.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async createVendor(
    organizationId: string,
    data: {
      name: string;
      contactName?: string;
      email?: string;
      phone?: string;
      paymentTerms?: string;
    },
    userId?: string,
  ) {
    if (!data.name?.trim()) throw new BadRequestException("Vendor name is required");
    const vendor = await this.prisma.vendor.create({
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
    await this.audit.record({
      organizationId,
      userId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.VENDOR,
      entityId: vendor.id,
      metadata: { name: vendor.name },
    });
    return vendor;
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
    userId?: string,
  ) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, organizationId },
    });
    if (!vendor) throw new NotFoundException("Vendor not found");

    const updated = await this.prisma.vendor.update({
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
    await this.audit.record({
      organizationId,
      userId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.VENDOR,
      entityId: vendorId,
    });
    return updated;
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
    userId?: string;
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

    const po = await this.prisma.purchaseOrder.create({
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
    await this.audit.record({
      organizationId: params.organizationId,
      userId: params.userId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.PURCHASE_ORDER,
      entityId: po.id,
      metadata: { vendorId: params.vendorId, lineCount: params.lines.length },
    });
    return po;
  }

  async submitPurchaseOrder(
    branchId: string,
    purchaseOrderId: string,
    organizationId: string,
    userId?: string,
  ) {
    const po = await this.getPurchaseOrder(branchId, purchaseOrderId);
    if (po.status !== PO_STATUS_DRAFT) {
      throw new BadRequestException("Only draft purchase orders can be submitted");
    }
    const updated = await this.prisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: PO_STATUS_SUBMITTED },
    });
    await this.audit.record({
      organizationId,
      userId,
      action: AuditAction.SUBMIT,
      entityType: AuditEntityType.PURCHASE_ORDER,
      entityId: purchaseOrderId,
    });
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: po.vendorId },
      select: { name: true },
    });
    await this.notifications.notifyOrganizationRoles(
      organizationId,
      [Role.ADMIN, Role.ACCOUNTANT],
      {
        type: NotificationType.PO_AWAITING_RECEIPT,
        title: "Purchase order awaiting receipt",
        body: `PO ${purchaseOrderId.slice(0, 8)}… from ${vendor?.name ?? "vendor"} is ready to receive.`,
        link: "/procurement",
        email: false,
      },
    );
    return updated;
  }

  async receiveGoods(params: {
    organizationId: string;
    branchId: string;
    purchaseOrderId: string;
    purchaseOrderLineId: string;
    quantity: number;
    userId?: string;
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

    await this.audit.record({
      organizationId: params.organizationId,
      userId: params.userId,
      action: AuditAction.RECEIVE,
      entityType: AuditEntityType.GOODS_RECEIPT,
      entityId: receipt.id,
      metadata: {
        purchaseOrderId: po.id,
        purchaseOrderLineId: line.id,
        quantity: params.quantity,
        movementId: movement.id,
      },
    });

    return receipt;
  }

  listVendorPayments(branchId: string) {
    return this.prisma.vendorPayment.findMany({
      where: { branchId },
      include: {
        vendor: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, status: true } },
      },
      orderBy: { paymentDate: "desc" },
      take: 100,
    });
  }

  async getVendorApBalance(
    organizationId: string,
    branchId: string,
    vendorId: string,
  ) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, organizationId },
    });
    if (!vendor) throw new NotFoundException("Vendor not found");

    const lines = await this.prisma.purchaseOrderLine.findMany({
      where: {
        purchaseOrder: { branchId, vendorId, organizationId },
      },
    });

    const accrued = roundMoney(
      lines.reduce((s, l) => s + toNumber(l.receivedQty) * toNumber(l.unitPrice), 0),
    );

    const paidAgg = await this.prisma.vendorPayment.aggregate({
      where: { organizationId, branchId, vendorId },
      _sum: { amount: true },
    });
    const paid = roundMoney(toNumber(paidAgg._sum.amount ?? 0));

    return { accrued, paid, balance: roundMoney(accrued - paid) };
  }

  async createVendorPayment(params: {
    organizationId: string;
    branchId: string;
    userId?: string;
    vendorId: string;
    amount: number;
    paymentDate?: string;
    payFromAccountCode?: string;
    purchaseOrderId?: string;
    reference?: string;
  }) {
    if (params.amount <= 0) {
      throw new BadRequestException("amount must be positive");
    }

    const payFrom = params.payFromAccountCode ?? "1100";
    if (!PAY_FROM_ACCOUNT_CODES.includes(payFrom as (typeof PAY_FROM_ACCOUNT_CODES)[number])) {
      throw new BadRequestException("payFromAccountCode must be 1000 (Cash) or 1100 (Bank)");
    }

    const vendor = await this.prisma.vendor.findFirst({
      where: { id: params.vendorId, organizationId: params.organizationId, isActive: true },
    });
    if (!vendor) throw new NotFoundException("Vendor not found");

    if (params.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: {
          id: params.purchaseOrderId,
          branchId: params.branchId,
          vendorId: params.vendorId,
          organizationId: params.organizationId,
        },
      });
      if (!po) {
        throw new BadRequestException("Purchase order does not match vendor or branch");
      }
    }

    const paymentDate = params.paymentDate
      ? new Date(params.paymentDate)
      : new Date();
    if (Number.isNaN(paymentDate.getTime())) {
      throw new BadRequestException("Invalid paymentDate");
    }

    const balance = await this.getVendorApBalance(
      params.organizationId,
      params.branchId,
      params.vendorId,
    );
    const amount = roundMoney(params.amount);
    if (amount > balance.balance) {
      throw new BadRequestException(
        `Payment ${amount} exceeds outstanding AP balance ${balance.balance} for this vendor`,
      );
    }

    const payment = await this.prisma.vendorPayment.create({
      data: {
        id: generatePrefixedId("vp"),
        organizationId: params.organizationId,
        branchId: params.branchId,
        vendorId: params.vendorId,
        purchaseOrderId: params.purchaseOrderId ?? null,
        amount,
        paymentDate,
        payFromAccountCode: payFrom,
        reference: params.reference?.trim() || null,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, status: true } },
      },
    });

    await this.accounting.postVendorPayment({
      organizationId: params.organizationId,
      vendorPaymentId: payment.id,
      amount,
      payFromAccountCode: payFrom,
      vendorName: vendor.name,
      userId: params.userId,
      paymentDate,
    });

    await this.audit.record({
      organizationId: params.organizationId,
      userId: params.userId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.VENDOR_PAYMENT,
      entityId: payment.id,
      metadata: {
        vendorId: params.vendorId,
        amount,
        purchaseOrderId: params.purchaseOrderId,
      },
    });

    return payment;
  }
}

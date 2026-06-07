import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrderStatus, PaymentStatus, ReservationStatus } from "@erp/types";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService, TransactionClient } from "../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { OrderCompletedEvent } from "../common/events/order-completed.event";
import { toNumber, generatePrefixedId } from "@erp/utils";
import { AuditAction, AuditEntityType } from "../audit/audit.constants";
import { AuditService } from "../audit/audit.service";
import { TenantScopeService } from "../common/tenant/tenant-scope.service";

const CANCELLABLE: string[] = [OrderStatus.DRAFT, OrderStatus.SUBMITTED];
const COMPLETABLE: string[] = [
  OrderStatus.SUBMITTED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
];
const KITCHEN_TRANSITIONS: Record<string, string[]> = {
  [OrderStatus.SUBMITTED]: [OrderStatus.PREPARING],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
};

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly realtime: RealtimeGateway,
    private readonly audit: AuditService,
    private readonly tenantScope: TenantScopeService,
  ) {}

  listCategories(branchId: string) {
    return this.prisma.menuCategory.findMany({
      where: { branchId },
      include: { items: { orderBy: { name: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });
  }

  async getCategory(branchId: string, categoryId: string) {
    const cat = await this.prisma.menuCategory.findFirst({
      where: { id: categoryId, branchId },
    });
    if (!cat) throw new NotFoundException("Menu category not found");
    return cat;
  }

  createCategory(
    organizationId: string,
    branchId: string,
    data: { name: string; sortOrder?: number },
  ) {
    if (!data.name?.trim()) {
      throw new BadRequestException("Category name is required");
    }
    return this.prisma.menuCategory.create({
      data: { organizationId, branchId, name: data.name.trim(), sortOrder: data.sortOrder ?? 0 },
    });
  }

  async updateCategory(
    branchId: string,
    categoryId: string,
    data: { name?: string; sortOrder?: number },
  ) {
    await this.getCategory(branchId, categoryId);
    return this.prisma.menuCategory.update({
      where: { id: categoryId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
      include: { items: true },
    });
  }

  async deleteCategory(branchId: string, categoryId: string) {
    await this.getCategory(branchId, categoryId);
    const itemCount = await this.prisma.menuItem.count({ where: { categoryId } });
    if (itemCount > 0) {
      throw new ConflictException("Category has menu items and cannot be deleted");
    }
    return this.prisma.menuCategory.delete({ where: { id: categoryId } });
  }

  async getMenuItemForBranch(
    organizationId: string,
    branchId: string,
    itemId: string,
  ) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      include: { category: true },
    });
    if (!item) throw new NotFoundException("Menu item not found");
    if (
      item.category.organizationId !== organizationId ||
      item.category.branchId !== branchId
    ) {
      throw new ForbiddenException("Menu item does not belong to this organization");
    }
    return item;
  }

  private async getCategoryForOrg(
    organizationId: string,
    branchId: string,
    categoryId: string,
  ) {
    const category = await this.prisma.menuCategory.findFirst({
      where: { id: categoryId, organizationId, branchId },
    });
    if (!category) throw new NotFoundException("Menu category not found");
    return category;
  }

  async createMenuItem(
    organizationId: string,
    branchId: string,
    data: {
      categoryId: string;
      name: string;
      price: number;
      isActive?: boolean;
      isGuestInclusionMeal?: boolean;
    },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("Item name is required");
    if (data.price < 0) throw new BadRequestException("Price cannot be negative");
    await this.getCategoryForOrg(organizationId, branchId, data.categoryId);
    return this.prisma.menuItem.create({
      data: {
        categoryId: data.categoryId,
        name: data.name.trim(),
        price: data.price,
        isActive: data.isActive ?? true,
        isGuestInclusionMeal: data.isGuestInclusionMeal ?? false,
      },
    });
  }

  async updateMenuItem(
    organizationId: string,
    branchId: string,
    itemId: string,
    data: {
      name?: string;
      price?: number;
      isActive?: boolean;
      categoryId?: string;
      isGuestInclusionMeal?: boolean;
    },
  ) {
    await this.getMenuItemForBranch(organizationId, branchId, itemId);
    if (data.price !== undefined && data.price < 0) {
      throw new BadRequestException("Price cannot be negative");
    }
    if (data.categoryId) {
      await this.getCategoryForOrg(organizationId, branchId, data.categoryId);
    }
    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.isGuestInclusionMeal !== undefined
          ? { isGuestInclusionMeal: data.isGuestInclusionMeal }
          : {}),
      },
    });
  }

  async deleteMenuItem(organizationId: string, branchId: string, itemId: string) {
    await this.getMenuItemForBranch(organizationId, branchId, itemId);
    const lineCount = await this.prisma.orderLine.count({ where: { menuItemId: itemId } });
    if (lineCount > 0) {
      throw new ConflictException("Menu item appears on orders and cannot be deleted");
    }
    return this.prisma.menuItem.delete({ where: { id: itemId } });
  }

  listOrders(branchId: string) {
    return this.prisma.order.findMany({
      where: { branchId },
      include: { lines: { include: { menuItem: true } }, kitchenTickets: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOrder(branchId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId },
      include: { lines: { include: { menuItem: true } }, kitchenTickets: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async createOrder(
    branchId: string,
    organizationId: string,
    data: {
      lines: { menuItemId: string; quantity: number; unitPrice: number }[];
      tableNumber?: string;
      notes?: string;
      reservationId?: string;
    },
  ) {
    if (!data.lines?.length) {
      throw new BadRequestException("Order must have at least one line");
    }
    for (const line of data.lines) {
      if (line.quantity <= 0) throw new BadRequestException("Line quantity must be positive");
      if (line.unitPrice < 0) throw new BadRequestException("Line unitPrice cannot be negative");
      await this.tenantScope.assertMenuItemInBranch(
        organizationId,
        branchId,
        line.menuItemId,
      );
    }

    if (data.reservationId) {
      const reservation = await this.prisma.reservation.findFirst({
        where: { id: data.reservationId, branchId },
      });
      if (!reservation) throw new NotFoundException("Reservation not found");
      if (reservation.status !== ReservationStatus.CHECKED_IN) {
        throw new BadRequestException("Only checked-in reservations can be charged to room");
      }
    }

    const total = data.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

    return this.prisma.order.create({
      data: {
        branchId,
        tableNumber: data.tableNumber,
        notes: data.notes,
        reservationId: data.reservationId ?? null,
        totalAmount: total,
        status: OrderStatus.DRAFT,
        lines: {
          create: data.lines.map((l) => ({
            id: generatePrefixedId("ol"),
            menuItemId: l.menuItemId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.quantity * l.unitPrice,
          })),
        },
      },
      include: { lines: { include: { menuItem: true } } },
    });
  }

  async submitOrder(orderId: string, branchId: string, _organizationId: string) {
    const order = await this.getOrder(branchId, orderId);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT orders can be submitted to the kitchen");
    }
    if (order.lines.length === 0) {
      throw new BadRequestException("Cannot submit an order with no lines");
    }

    const updated = await this.prisma.$transaction(async (tx: TransactionClient) => {
      const o = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.SUBMITTED },
        include: { lines: { include: { menuItem: true } } },
      });
      const ticket = await tx.kitchenTicket.create({
        data: { id: generatePrefixedId("kt"), orderId, status: OrderStatus.SUBMITTED },
      });
      return { order: o, ticket };
    });

    this.realtime.emitKitchenTicket(branchId, updated.ticket);
    this.realtime.emitOrderUpdate(branchId, updated.order);
    return updated;
  }

  async completeOrder(
    orderId: string,
    branchId: string,
    organizationId: string,
    paidAmount?: number,
    userId?: string,
  ) {
    const order = await this.getOrder(branchId, orderId);

    if (!COMPLETABLE.includes(order.status)) {
      throw new BadRequestException(
        "Only SUBMITTED, PREPARING, or READY orders can be completed",
      );
    }

    const total = toNumber(order.totalAmount);
    const paid = paidAmount ?? total;
    if (paid < 0) throw new BadRequestException("paidAmount cannot be negative");
    if (paid > total) throw new BadRequestException("paidAmount cannot exceed totalAmount");

    const updated = await this.prisma.$transaction(async (tx: TransactionClient) => {
      const o = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.COMPLETED,
          paymentStatus:
            paid >= total
              ? PaymentStatus.PAID
              : paid > 0
                ? PaymentStatus.PARTIAL
                : PaymentStatus.UNPAID,
          paidAmount: paid,
        },
        include: { lines: { include: { menuItem: true } } },
      });
      await tx.kitchenTicket.updateMany({
        where: { orderId, status: { not: OrderStatus.COMPLETED } },
        data: { status: OrderStatus.COMPLETED },
      });
      return o;
    });

    this.events.emit(
      "order.completed",
      new OrderCompletedEvent(orderId, branchId, organizationId, total, paid),
    );
    this.realtime.emitOrderUpdate(branchId, updated);

    await this.audit.record({
      organizationId,
      userId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.ORDER,
      entityId: orderId,
      metadata: { status: OrderStatus.COMPLETED, paidAmount: paid },
    });

    return updated;
  }

  async cancelOrder(
    orderId: string,
    branchId: string,
    organizationId: string,
    userId?: string,
  ) {
    const order = await this.getOrder(branchId, orderId);

    if (!CANCELLABLE.includes(order.status)) {
      throw new BadRequestException("Only DRAFT or SUBMITTED orders can be cancelled");
    }

    const updated = await this.prisma.$transaction(async (tx: TransactionClient) => {
      const o = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
        include: { lines: { include: { menuItem: true } } },
      });
      await tx.kitchenTicket.updateMany({
        where: { orderId },
        data: { status: OrderStatus.CANCELLED },
      });
      return o;
    });

    this.realtime.emitOrderUpdate(branchId, updated);

    await this.audit.record({
      organizationId,
      userId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.ORDER,
      entityId: orderId,
      metadata: { status: OrderStatus.CANCELLED },
    });

    return updated;
  }

  async updateOrderStatus(orderId: string, branchId: string, status: OrderStatus) {
    const order = await this.getOrder(branchId, orderId);
    const from = order.status as OrderStatus;

    if (!KITCHEN_TRANSITIONS[from]?.includes(status)) {
      throw new BadRequestException(`Cannot change order status from ${from} to ${status}`);
    }

    const updated = await this.prisma.$transaction(async (tx: TransactionClient) => {
      const o = await tx.order.update({
        where: { id: orderId },
        data: { status },
        include: { lines: { include: { menuItem: true } } },
      });
      await tx.kitchenTicket.updateMany({
        where: { orderId, status: from },
        data: { status },
      });
      return o;
    });

    this.realtime.emitOrderUpdate(branchId, updated);
    return updated;
  }

  async deleteOrder(orderId: string, branchId: string) {
    const order = await this.getOrder(branchId, orderId);

    const deletable: string[] = [OrderStatus.DRAFT, OrderStatus.CANCELLED];
    if (!deletable.includes(order.status)) {
      throw new BadRequestException(
        "Only DRAFT or CANCELLED orders can be deleted; completed orders must be kept for audit",
      );
    }

    await this.prisma.$transaction([
      this.prisma.kitchenTicket.deleteMany({ where: { orderId } }),
      this.prisma.order.delete({ where: { id: orderId } }),
    ]);

    return { id: orderId };
  }
}

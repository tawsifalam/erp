import { Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService, TransactionClient } from "../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { OrderCompletedEvent } from "../common/events/order-completed.event";
import { toNumber, generatePrefixedId } from "@erp/utils";

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly realtime: RealtimeGateway,
  ) {}

  listCategories(branchId: string) {
    return this.prisma.menuCategory.findMany({
      where: { branchId },
      include: { items: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  createCategory(
    organizationId: string,
    branchId: string,
    data: { name: string; sortOrder?: number },
  ) {
    return this.prisma.menuCategory.create({
      data: { organizationId, branchId, name: data.name, sortOrder: data.sortOrder ?? 0 },
    });
  }

  createMenuItem(data: {
    categoryId: string;
    name: string;
    price: number;
    isActive?: boolean;
  }) {
    return this.prisma.menuItem.create({ data });
  }

  listOrders(branchId: string) {
    return this.prisma.order.findMany({
      where: { branchId },
      include: { lines: { include: { menuItem: true } }, kitchenTickets: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async createOrder(
    branchId: string,
    organizationId: string,
    data: {
      lines: { menuItemId: string; quantity: number; unitPrice: number }[];
      tableNumber?: string;
      notes?: string;
    },
  ) {
    const total = data.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

    const order = await this.prisma.order.create({
      data: {
        branchId,
        tableNumber: data.tableNumber,
        notes: data.notes,
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

    return order;
  }

  async submitOrder(orderId: string, branchId: string, organizationId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId },
      include: { lines: true },
    });
    if (!order) throw new NotFoundException("Order not found");

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
  ) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, branchId } });
    if (!order) throw new NotFoundException("Order not found");

    const total = toNumber(order.totalAmount);
    const paid = paidAmount ?? total;

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.COMPLETED,
        paymentStatus:
          paid >= total ? PaymentStatus.PAID : paid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID,
        paidAmount: paid,
      },
      include: { lines: { include: { menuItem: true } } },
    });

    this.events.emit(
      "order.completed",
      new OrderCompletedEvent(orderId, branchId, organizationId, total),
    );
    this.realtime.emitOrderUpdate(branchId, updated);
    return updated;
  }

  async updateOrderStatus(orderId: string, branchId: string, status: OrderStatus) {
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
    this.realtime.emitOrderUpdate(branchId, updated);
    return updated;
  }
}

import { Injectable } from "@nestjs/common";
import { ReservationStatus, OrderStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly events: EventEmitter2,
  ) {}

  async dashboard(organizationId: string, branchId: string) {
    const [rooms, reservations, orders, items] = await Promise.all([
      this.prisma.room.count({ where: { branchId } }),
      this.prisma.reservation.count({
        where: {
          branchId,
          status: { in: [ReservationStatus.CHECKED_IN, ReservationStatus.CONFIRMED] },
        },
      }),
      this.prisma.order.aggregate({
        where: {
          branchId,
          status: OrderStatus.COMPLETED,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        _sum: { totalAmount: true },
      }),
      this.inventory.listItemsWithStock(branchId),
    ]);

    const lowStock = items.filter(
      (i) =>
        i.lowStockThreshold != null &&
        i.currentStock <= Number(i.lowStockThreshold),
    );

    return {
      occupancyPct: rooms > 0 ? Math.round((reservations / rooms) * 100) : 0,
      activeReservations: reservations,
      revenueToday: Number(orders._sum.totalAmount ?? 0),
      lowStockAlerts: lowStock.length,
      lowStockItems: lowStock,
    };
  }

  requestExport(organizationId: string, type: string) {
    return this.prisma.reportJob.create({
      data: { organizationId, type, status: "PENDING" },
    });
  }
}

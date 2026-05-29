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
    const [rooms, occupiedRooms, activeReservations, orders, items] = await Promise.all([
      this.prisma.room.count({ where: { branchId } }),
      this.prisma.room.count({
        where: { branchId, status: "OCCUPIED" },
      }),
      this.prisma.reservation.count({
        where: {
          branchId,
          status: {
            in: [
              ReservationStatus.INQUIRY,
              ReservationStatus.CONFIRMED,
              ReservationStatus.CHECKED_IN,
            ],
          },
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
      occupancyPct: rooms > 0 ? Math.round((occupiedRooms / rooms) * 100) : 0,
      activeReservations,
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

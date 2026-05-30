import { Injectable } from "@nestjs/common";
import { OrderStatus, ReservationStatus } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import {
  REPORT_TYPE_BRANCH_SUMMARY,
  REPORT_TYPE_LOW_STOCK,
  REPORT_TYPE_REVENUE_TODAY,
  toCsv,
} from "./reporting.constants";

@Injectable()
export class ReportGeneratorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async generate(type: string, branchId: string): Promise<string> {
    switch (type) {
      case REPORT_TYPE_BRANCH_SUMMARY:
        return this.branchSummaryCsv(branchId);
      case REPORT_TYPE_LOW_STOCK:
        return this.lowStockCsv(branchId);
      case REPORT_TYPE_REVENUE_TODAY:
        return this.revenueTodayCsv(branchId);
      default:
        throw new Error(`No generator for report type: ${type}`);
    }
  }

  private async branchSummaryCsv(branchId: string): Promise<string> {
    const [rooms, occupiedRooms, activeReservations, orders, items] = await Promise.all([
      this.prisma.room.count({ where: { branchId } }),
      this.prisma.room.count({ where: { branchId, status: "OCCUPIED" } }),
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
    const occupancyPct = rooms > 0 ? Math.round((occupiedRooms / rooms) * 100) : 0;
    const revenueToday = Number(orders._sum.totalAmount ?? 0);

    return toCsv(
      ["metric", "value"],
      [
        ["occupancyPct", occupancyPct],
        ["activeReservations", activeReservations],
        ["revenueToday", revenueToday],
        ["lowStockAlerts", lowStock.length],
        ["totalRooms", rooms],
        ["occupiedRooms", occupiedRooms],
      ],
    );
  }

  private async lowStockCsv(branchId: string): Promise<string> {
    const items = await this.inventory.listItemsWithStock(branchId);
    const lowStock = items.filter(
      (i) =>
        i.lowStockThreshold != null &&
        i.currentStock <= Number(i.lowStockThreshold),
    );

    return toCsv(
      ["sku", "name", "unit", "pool", "currentStock", "lowStockThreshold"],
      lowStock.map((i) => [
        i.sku,
        i.name,
        i.unit,
        i.pool?.name ?? "",
        i.currentStock,
        Number(i.lowStockThreshold),
      ]),
    );
  }

  private async revenueTodayCsv(branchId: string): Promise<string> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        status: OrderStatus.COMPLETED,
        createdAt: { gte: start },
      },
      orderBy: { createdAt: "asc" },
    });

    return toCsv(
      ["orderId", "tableNumber", "totalAmount", "paidAmount", "paymentStatus", "createdAt"],
      orders.map((o) => [
        o.id,
        o.tableNumber ?? "",
        Number(o.totalAmount),
        Number(o.paidAmount),
        o.paymentStatus,
        o.createdAt.toISOString(),
      ]),
    );
  }
}

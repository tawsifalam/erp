import { BadRequestException, Injectable } from "@nestjs/common";
import { ReservationStatus, OrderStatus } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import {
  BRANCH_SCOPED_REPORT_TYPES,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  isValidReportType,
  normalizeReportType,
} from "./reporting.constants";

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async dashboard(_organizationId: string, branchId: string) {
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
      lowStockItems: lowStock.map((i) => ({
        id: i.id,
        sku: i.sku,
        name: i.name,
        unit: i.unit,
        currentStock: i.currentStock,
        lowStockThreshold: Number(i.lowStockThreshold),
        pool: i.pool,
      })),
    };
  }

  listReportTypes() {
    return REPORT_TYPES.map((code) => ({
      code,
      label: REPORT_TYPE_LABELS[code],
      requiresBranch: BRANCH_SCOPED_REPORT_TYPES.has(code),
    }));
  }

  listJobs(organizationId: string, limit = 20) {
    return this.prisma.reportJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  requestExport(organizationId: string, type: string, branchId?: string) {
    if (!type?.trim()) throw new BadRequestException("Report type is required");
    if (!isValidReportType(type)) {
      throw new BadRequestException(
        `Invalid report type. Allowed: ${REPORT_TYPES.join(", ")} (summary alias supported)`,
      );
    }

    const normalizedType = normalizeReportType(type);
    if (BRANCH_SCOPED_REPORT_TYPES.has(normalizedType) && !branchId) {
      throw new BadRequestException("Branch is required for this report type");
    }

    return this.prisma.reportJob.create({
      data: {
        organizationId,
        branchId: branchId ?? null,
        type: normalizedType,
        status: "PENDING",
      },
    });
  }
}

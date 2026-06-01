import { BadRequestException, Injectable } from "@nestjs/common";
import { ReservationStatus, OrderStatus } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import {
  BRANCH_SCOPED_REPORT_TYPES,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  ReportExportParams,
  isFinancialReportType,
  isValidReportType,
  normalizeReportType,
  parseReportDate,
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
      requiresDateRange: code === "profit_and_loss" || code === "general_ledger",
      requiresAsOf: code === "trial_balance" || code === "balance_sheet",
      requiresAccountCode: code === "general_ledger",
    }));
  }

  listJobs(organizationId: string, limit = 20) {
    return this.prisma.reportJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  requestExport(
    organizationId: string,
    type: string,
    branchId?: string,
    params?: ReportExportParams,
    requestedByUserId?: string,
  ) {
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

    const storedParams = this.validateExportParams(normalizedType, params);

    return this.prisma.reportJob.create({
      data: {
        organizationId,
        branchId: branchId ?? null,
        requestedByUserId: requestedByUserId ?? null,
        type: normalizedType,
        status: "PENDING",
        params: storedParams ?? undefined,
      },
    });
  }

  private validateExportParams(
    type: string,
    params?: ReportExportParams,
  ): ReportExportParams | null {
    if (!isFinancialReportType(type)) return null;

    const stored: ReportExportParams = {
      from: params?.from,
      to: params?.to,
      asOf: params?.asOf,
      accountCode: params?.accountCode,
    };

    try {
      if (type === "profit_and_loss" || type === "general_ledger") {
        parseReportDate(stored.to, new Date());
        parseReportDate(stored.from, new Date());
      }
      if (type === "trial_balance" || type === "balance_sheet") {
        parseReportDate(stored.asOf ?? stored.to, new Date());
      }
      if (type === "general_ledger" && !stored.accountCode?.trim()) {
        throw new BadRequestException("accountCode is required for general ledger");
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(e instanceof Error ? e.message : "Invalid report params");
    }

    return stored;
  }
}

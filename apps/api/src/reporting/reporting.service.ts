import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ReservationStatus, OrderStatus } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { StorageService } from "../storage/storage.service";
import { ReportGeneratorsService } from "./report-generators.service";
import { FinancialReportGeneratorsService } from "./financial-report-generators.service";
import {
  BRANCH_SCOPED_REPORT_TYPES,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  ReportExportParams,
  isFinancialReportType,
  isValidReportType,
  normalizeReportFormat,
  normalizeReportType,
  parseReportDate,
  REPORT_FORMAT_PDF,
} from "./reporting.constants";

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly generators: ReportGeneratorsService,
    private readonly financialGenerators: FinancialReportGeneratorsService,
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
      supportsPdf: isFinancialReportType(code),
    }));
  }

  listJobs(organizationId: string, limit = 20) {
    return this.prisma.reportJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async downloadJob(organizationId: string, jobId: string) {
    const job = await this.prisma.reportJob.findFirst({
      where: { id: jobId, organizationId },
    });
    if (!job || job.status !== "COMPLETED" || !job.fileUrl) {
      throw new NotFoundException("Report file not available");
    }

    const key = this.storageKeyFromFileUrl(job.fileUrl);
    const meta = this.reportContentMeta(job, key);
    let body = await this.storage.download(key);

    if (!body) {
      body = await this.generateReportBody(job);
      void this.storage.upload(key, body, meta.contentType).catch(() => undefined);
    }

    return {
      body,
      contentType: meta.contentType,
      filename: `${job.type}-${job.id}.${meta.extension}`,
    };
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

    let format;
    try {
      format = normalizeReportFormat(params?.format);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Invalid report format");
    }
    if (format === REPORT_FORMAT_PDF && !isFinancialReportType(normalizedType)) {
      throw new BadRequestException("PDF export is only available for financial reports");
    }

    const storedParams = this.validateExportParams(normalizedType, { ...params, format });

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

    const format = normalizeReportFormat(params?.format);

    const stored: ReportExportParams = {
      from: params?.from,
      to: params?.to,
      asOf: params?.asOf,
      accountCode: params?.accountCode,
      format,
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

  private storageKeyFromFileUrl(fileUrl: string): string {
    const bucket = this.config.get("MINIO_BUCKET", "erp-files");
    const prefix = `${bucket}/`;
    if (fileUrl.startsWith(prefix)) return fileUrl.slice(prefix.length);
    return fileUrl;
  }

  private reportContentMeta(
    job: { params: unknown },
    key: string,
  ): { extension: string; contentType: string } {
    const params = (job.params ?? {}) as ReportExportParams;
    const isPdf = params.format === REPORT_FORMAT_PDF || key.endsWith(".pdf");
    return {
      extension: isPdf ? "pdf" : "csv",
      contentType: isPdf ? "application/pdf" : "text/csv",
    };
  }

  private async generateReportBody(job: {
    type: string;
    organizationId: string;
    branchId: string | null;
    params: unknown;
  }): Promise<Buffer> {
    if (!isFinancialReportType(job.type) && !job.branchId) {
      throw new NotFoundException("Report file not found");
    }

    const params = (job.params ?? {}) as ReportExportParams;
    const isPdf = params.format === REPORT_FORMAT_PDF;
    if (isPdf && !isFinancialReportType(job.type)) {
      throw new NotFoundException("Report file not found");
    }

    if (isFinancialReportType(job.type)) {
      if (isPdf) {
        return this.financialGenerators.generatePdf(job.type, job.organizationId, params);
      }
      const csv = await this.financialGenerators.generate(
        job.type,
        job.organizationId,
        params,
      );
      return Buffer.from(csv);
    }

    const csv = await this.generators.generate(job.type, job.branchId!);
    return Buffer.from(csv);
  }
}

import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { ReportGeneratorsService } from "./report-generators.service";
import { FinancialReportGeneratorsService } from "./financial-report-generators.service";
import {
  REPORT_FORMAT_PDF,
  REPORT_TYPE_LABELS,
  isFinancialReportType,
  type ReportExportParams,
} from "./reporting.constants";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "../notifications/notifications.constants";

@Processor("reports")
export class ReportsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly generators: ReportGeneratorsService,
    private readonly financialGenerators: FinancialReportGeneratorsService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<{ reportJobId: string }>) {
    const reportJob = await this.prisma.reportJob.findUnique({
      where: { id: job.data.reportJobId },
    });
    if (!reportJob) return;

    await this.prisma.reportJob.update({
      where: { id: reportJob.id },
      data: { status: "PROCESSING", errorMessage: null },
    });

    try {
      if (!isFinancialReportType(reportJob.type) && !reportJob.branchId) {
        throw new Error("Report job missing branchId");
      }

      const params = (reportJob.params ?? {}) as ReportExportParams;
      const isPdf = params.format === REPORT_FORMAT_PDF;
      if (isPdf && !isFinancialReportType(reportJob.type)) {
        throw new Error("PDF export is only available for financial reports");
      }

      let fileBody: Buffer;
      let extension: string;
      let contentType: string;

      if (isFinancialReportType(reportJob.type)) {
        if (isPdf) {
          fileBody = await this.financialGenerators.generatePdf(
            reportJob.type,
            reportJob.organizationId,
            params,
          );
          extension = "pdf";
          contentType = "application/pdf";
        } else {
          const csv = await this.financialGenerators.generate(
            reportJob.type,
            reportJob.organizationId,
            params,
          );
          fileBody = Buffer.from(csv);
          extension = "csv";
          contentType = "text/csv";
        }
      } else {
        const csv = await this.generators.generate(reportJob.type, reportJob.branchId!);
        fileBody = Buffer.from(csv);
        extension = "csv";
        contentType = "text/csv";
      }

      const result = await this.storage.upload(
        `reports/${reportJob.id}.${extension}`,
        fileBody,
        contentType,
      );

      await this.prisma.reportJob.update({
        where: { id: reportJob.id },
        data: {
          status: "COMPLETED",
          fileUrl: result.url ?? result.key,
          completedAt: new Date(),
          errorMessage: null,
        },
      });

      if (reportJob.requestedByUserId) {
        const label =
          REPORT_TYPE_LABELS[reportJob.type as keyof typeof REPORT_TYPE_LABELS] ??
          reportJob.type;
        await this.notifications.notifyUser({
          organizationId: reportJob.organizationId,
          userId: reportJob.requestedByUserId,
          type: NotificationType.REPORT_READY,
          title: "Report ready",
          body: `Your ${label} export is ready to download.`,
          link: "/reports",
          email: false,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Report generation failed";
      await this.prisma.reportJob.update({
        where: { id: reportJob.id },
        data: {
          status: "FAILED",
          errorMessage: message,
          completedAt: new Date(),
        },
      });
    }
  }
}

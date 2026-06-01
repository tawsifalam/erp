import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { ReportGeneratorsService } from "./report-generators.service";
import { FinancialReportGeneratorsService } from "./financial-report-generators.service";
import { isFinancialReportType } from "./reporting.constants";
import type { ReportExportParams } from "./reporting.constants";

@Processor("reports")
export class ReportsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly generators: ReportGeneratorsService,
    private readonly financialGenerators: FinancialReportGeneratorsService,
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
      const csv = isFinancialReportType(reportJob.type)
        ? await this.financialGenerators.generate(
            reportJob.type,
            reportJob.organizationId,
            params,
          )
        : await this.generators.generate(
            reportJob.type,
            reportJob.branchId!,
          );
      const result = await this.storage.upload(
        `reports/${reportJob.id}.csv`,
        Buffer.from(csv),
        "text/csv",
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

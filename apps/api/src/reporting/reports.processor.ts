import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

@Processor("reports")
export class ReportsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<{ reportJobId: string }>) {
    const reportJob = await this.prisma.reportJob.findUnique({
      where: { id: job.data.reportJobId },
    });
    if (!reportJob) return;

    const csv = `type,organizationId\n${reportJob.type},${reportJob.organizationId}\n`;
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
      },
    });
  }
}

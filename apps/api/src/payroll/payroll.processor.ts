import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PayrollRunStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { toNumber } from "@erp/utils";

@Processor("payroll")
export class PayrollProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<{ payrollRunId: string }>) {
    const { payrollRunId } = job.data;
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
    });
    if (!run) return;

    await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: PayrollRunStatus.PROCESSING },
    });

    const employees = await this.prisma.employee.findMany({
      where: { organizationId: run.organizationId },
    });

    for (const emp of employees) {
      const gross = toNumber(emp.salary);
      const deductions = 0;
      const net = gross - deductions;
      await this.prisma.payrollLine.create({
        data: {
          payrollRunId,
          employeeId: emp.id,
          grossPay: gross,
          deductions,
          netPay: net,
        },
      });
    }

    const pdfKey = `payroll/${payrollRunId}.txt`;
    const content = Buffer.from(`Payroll run ${payrollRunId} completed`);
    await this.storage.upload(pdfKey, content, "text/plain");

    await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: PayrollRunStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }
}

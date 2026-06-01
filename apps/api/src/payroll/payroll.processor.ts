import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { EmployeeStatus, PayrollRunStatus } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { PayrollJournalService } from "../accounting/payroll-journal.service";
import { Role } from "@erp/types";
import { toNumber } from "@erp/utils";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "../notifications/notifications.constants";

export function computePayrollLine(
  grossSalary: number,
  pendingMealDeduction: number,
): { grossPay: number; deductions: number; netPay: number } {
  const grossPay = grossSalary;
  const deductions = Math.min(pendingMealDeduction, grossPay);
  const netPay = grossPay - deductions;
  return { grossPay, deductions, netPay };
}

@Processor("payroll")
export class PayrollProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly payrollJournal: PayrollJournalService,
    private readonly notifications: NotificationsService,
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

    try {
      await this.runPayroll(payrollRunId, run.organizationId, run.periodStart, run.periodEnd);
    } catch (err) {
      await this.prisma.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          status: PayrollRunStatus.FAILED,
          completedAt: new Date(),
        },
      });
      await this.notifications.notifyOrganizationRoles(
        run.organizationId,
        [Role.ADMIN, Role.HR],
        {
          type: NotificationType.PAYROLL_FAILED,
          title: "Payroll run failed",
          body: `Payroll run ${payrollRunId} could not be completed.`,
          link: "/hr",
          email: true,
        },
      );
      throw err;
    }
  }

  private async runPayroll(
    payrollRunId: string,
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const employees = await this.prisma.employee.findMany({
      where: { organizationId, status: EmployeeStatus.ACTIVE },
    });

    for (const emp of employees) {
      const pendingMeals = await this.prisma.staffMeal.findMany({
        where: {
          employeeId: emp.id,
          deductFromPayroll: true,
          payrollDeducted: false,
        },
      });
      const mealDeduction = pendingMeals.reduce(
        (sum, m) => sum + m.mealCount * toNumber(m.unitCostPerMeal),
        0,
      );
      const { grossPay, deductions, netPay } = computePayrollLine(
        toNumber(emp.salary),
        mealDeduction,
      );

      await this.prisma.payrollLine.create({
        data: {
          payrollRunId,
          employeeId: emp.id,
          grossPay,
          deductions,
          netPay,
        },
      });

      if (pendingMeals.length > 0) {
        await this.prisma.staffMeal.updateMany({
          where: { id: { in: pendingMeals.map((m) => m.id) } },
          data: { payrollDeducted: true },
        });
      }
    }

    const pdfKey = `payroll/${payrollRunId}.txt`;
    const content = Buffer.from(`Payroll run ${payrollRunId} completed`);
    await this.storage.upload(pdfKey, content, "text/plain");

    await this.payrollJournal.postPayrollRunJournal(payrollRunId, organizationId);

    await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: PayrollRunStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    const fmt = (d: Date) =>
      d instanceof Date && !Number.isNaN(d.getTime())
        ? d.toISOString().slice(0, 10)
        : String(d).slice(0, 10);
    const periodLabel = `${fmt(periodStart)} – ${fmt(periodEnd)}`;
    await this.notifications.notifyOrganizationRoles(
      organizationId,
      [Role.ADMIN, Role.HR],
      {
        type: NotificationType.PAYROLL_COMPLETED,
        title: "Payroll completed",
        body: `Payroll for ${periodLabel} has been processed.`,
        link: "/hr",
        email: true,
      },
    );
  }
}

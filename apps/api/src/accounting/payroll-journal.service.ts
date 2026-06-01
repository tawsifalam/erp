import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingService } from "./accounting.service";
import { roundMoney, toNumber } from "@erp/utils";

/** Posts a single summary journal when a payroll run completes. */
@Injectable()
export class PayrollJournalService {
  private readonly logger = new Logger(PayrollJournalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  async postPayrollRunJournal(payrollRunId: string, organizationId: string) {
    const lines = await this.prisma.payrollLine.findMany({
      where: { payrollRunId },
    });
    if (lines.length === 0) return;

    const existing = await this.prisma.journalEntry.findFirst({
      where: {
        organizationId,
        referenceType: "payroll_run",
        referenceId: payrollRunId,
      },
    });
    if (existing) return;

    const salaryExpense = await this.accounting.getAccountByCode(organizationId, "5100");
    const salaryPayable = await this.accounting.getAccountByCode(organizationId, "2100");
    if (!salaryExpense || !salaryPayable) {
      this.logger.warn(
        `Skipping payroll journal for ${payrollRunId}: missing 5100 or 2100 accounts`,
      );
      return;
    }

    let totalGross = 0;
    let totalNet = 0;
    let totalDeductions = 0;
    for (const line of lines) {
      totalGross += toNumber(line.grossPay);
      totalNet += toNumber(line.netPay);
      totalDeductions += toNumber(line.deductions);
    }

    totalGross = roundMoney(totalGross);
    totalNet = roundMoney(totalNet);
    totalDeductions = roundMoney(totalDeductions);

    const journalLines: { accountId: string; debit: number; credit: number }[] = [
      { accountId: salaryExpense.id, debit: totalGross, credit: 0 },
      { accountId: salaryPayable.id, debit: 0, credit: totalNet },
    ];

    if (totalDeductions > 0) {
      const deductionAccount =
        (await this.accounting.getAccountByCode(organizationId, "5150")) ??
        (await this.accounting.getAccountByCode(organizationId, "5200"));
      if (!deductionAccount) {
        this.logger.warn(
          `Skipping payroll deductions journal line: no 5150/5200 account for org ${organizationId}`,
        );
        return;
      }
      journalLines.push({
        accountId: deductionAccount.id,
        debit: 0,
        credit: totalDeductions,
      });
    }

    await this.accounting.createJournalEntry({
      organizationId,
      referenceType: "payroll_run",
      referenceId: payrollRunId,
      description: `Payroll run ${payrollRunId}`,
      lines: journalLines,
    });
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AccountType } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { AuditAction, AuditEntityType } from "../audit/audit.constants";
import { AuditService } from "../audit/audit.service";
import { roundMoney, generatePrefixedId } from "@erp/utils";
import { FiscalPeriodStatus } from "./fiscal-period.constants";
import { periodContainsDate, periodsOverlap } from "./fiscal-period.utils";

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listAccounts(organizationId: string) {
    return this.prisma.account.findMany({ where: { organizationId } });
  }

  createAccount(
    organizationId: string,
    data: { code: string; name: string; type: string },
  ) {
    if (!data.code?.trim()) throw new BadRequestException("Account code is required");
    if (!data.name?.trim()) throw new BadRequestException("Account name is required");
    const validTypes = Object.values(AccountType);
    if (!validTypes.includes(data.type as AccountType)) {
      throw new BadRequestException(`type must be one of: ${validTypes.join(", ")}`);
    }

    return this.prisma.account.create({
      data: {
        organizationId,
        code: data.code.trim(),
        name: data.name.trim(),
        type: data.type as AccountType,
      },
    });
  }

  listFiscalPeriods(organizationId: string) {
    return this.prisma.fiscalPeriod.findMany({
      where: { organizationId },
      orderBy: { startDate: "desc" },
    });
  }

  async createFiscalPeriod(
    organizationId: string,
    data: { name: string; startDate: string; endDate: string },
    userId?: string,
  ) {
    const name = data.name?.trim();
    if (!name) throw new BadRequestException("Period name is required");

    const startDate = this.parseDate(data.startDate, "startDate");
    const endDate = this.parseDate(data.endDate, "endDate");
    if (startDate > endDate) {
      throw new BadRequestException("startDate must be on or before endDate");
    }

    const existing = await this.prisma.fiscalPeriod.findMany({
      where: { organizationId },
    });
    for (const p of existing) {
      if (periodsOverlap(p, { startDate, endDate })) {
        throw new BadRequestException(
          `Date range overlaps existing period "${p.name}"`,
        );
      }
    }

    const period = await this.prisma.fiscalPeriod.create({
      data: {
        organizationId,
        name,
        startDate,
        endDate,
        status: FiscalPeriodStatus.OPEN,
      },
    });

    await this.audit.record({
      organizationId,
      userId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.FISCAL_PERIOD,
      entityId: period.id,
      metadata: { name, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    });

    return period;
  }

  async closeFiscalPeriod(organizationId: string, periodId: string, userId?: string) {
    const period = await this.findFiscalPeriod(organizationId, periodId);
    if (period.status === FiscalPeriodStatus.CLOSED) {
      throw new BadRequestException("Period is already closed");
    }

    const updated = await this.prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: {
        status: FiscalPeriodStatus.CLOSED,
        closedAt: new Date(),
        closedByUserId: userId ?? null,
      },
    });

    await this.audit.record({
      organizationId,
      userId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.FISCAL_PERIOD,
      entityId: periodId,
      metadata: { status: FiscalPeriodStatus.CLOSED },
    });

    return updated;
  }

  async reopenFiscalPeriod(organizationId: string, periodId: string, userId?: string) {
    const period = await this.findFiscalPeriod(organizationId, periodId);
    if (period.status === FiscalPeriodStatus.OPEN) {
      throw new BadRequestException("Period is already open");
    }

    const updated = await this.prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: {
        status: FiscalPeriodStatus.OPEN,
        closedAt: null,
        closedByUserId: null,
      },
    });

    await this.audit.record({
      organizationId,
      userId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.FISCAL_PERIOD,
      entityId: periodId,
      metadata: { status: FiscalPeriodStatus.OPEN },
    });

    return updated;
  }

  listJournalEntries(organizationId: string) {
    return this.prisma.journalEntry.findMany({
      where: { organizationId },
      include: {
        lines: { include: { account: true } },
        fiscalPeriod: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async createJournalEntry(params: {
    organizationId: string;
    lines: { accountId: string; debit: number; credit: number }[];
    referenceType?: string;
    referenceId?: string;
    description?: string;
    userId?: string;
    entryDate?: string | Date;
  }) {
    const totalDebit = roundMoney(
      params.lines.reduce((s, l) => s + l.debit, 0),
    );
    const totalCredit = roundMoney(
      params.lines.reduce((s, l) => s + l.credit, 0),
    );

    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Journal entry not balanced: debit=${totalDebit} credit=${totalCredit}`,
      );
    }

    if (params.lines.length < 2) {
      throw new BadRequestException("At least two journal lines required");
    }

    const entryDate =
      params.entryDate instanceof Date
        ? params.entryDate
        : params.entryDate
          ? this.parseDate(params.entryDate, "entryDate")
          : new Date();

    const fiscalPeriod = await this.resolveOpenFiscalPeriod(
      params.organizationId,
      entryDate,
    );

    const entry = await this.prisma.journalEntry.create({
      data: {
        organizationId: params.organizationId,
        description: params.description,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        entryDate,
        fiscalPeriodId: fiscalPeriod.id,
        lines: {
          create: params.lines.map((l) => ({
            id: generatePrefixedId("jl"),
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
          })),
        },
      },
      include: {
        lines: { include: { account: true } },
        fiscalPeriod: { select: { id: true, name: true, status: true } },
      },
    });

    await this.audit.record({
      organizationId: params.organizationId,
      userId: params.userId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.JOURNAL_ENTRY,
      entityId: entry.id,
      metadata: {
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        lineCount: params.lines.length,
        fiscalPeriodId: fiscalPeriod.id,
      },
    });

    return entry;
  }

  async getAccountByCode(organizationId: string, code: string) {
    return this.prisma.account.findUnique({
      where: { organizationId_code: { organizationId, code } },
    });
  }

  private parseDate(value: string, field: string): Date {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return d;
  }

  private async findFiscalPeriod(organizationId: string, periodId: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id: periodId, organizationId },
    });
    if (!period) throw new NotFoundException("Fiscal period not found");
    return period;
  }

  private async resolveOpenFiscalPeriod(organizationId: string, entryDate: Date) {
    const periods = await this.prisma.fiscalPeriod.findMany({
      where: { organizationId },
      orderBy: { startDate: "desc" },
    });

    const match = periods.find((p) => periodContainsDate(p, entryDate));
    if (!match) {
      throw new BadRequestException(
        "No fiscal period covers this entry date. Create an open period first.",
      );
    }
    if (match.status !== FiscalPeriodStatus.OPEN) {
      throw new BadRequestException(
        `Fiscal period "${match.name}" is closed. Reopen it or choose another entry date.`,
      );
    }
    return match;
  }
}

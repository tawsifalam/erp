import { Injectable } from "@nestjs/common";
import { AccountType } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { roundMoney, toNumber } from "@erp/utils";
import {
  REPORT_TYPE_BALANCE_SHEET,
  REPORT_TYPE_GENERAL_LEDGER,
  REPORT_TYPE_PROFIT_AND_LOSS,
  REPORT_TYPE_TRIAL_BALANCE,
  ReportExportParams,
  parseReportDate,
  toCsv,
} from "./reporting.constants";

type AccountBalance = {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
};

@Injectable()
export class FinancialReportGeneratorsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(type: string, organizationId: string, params: ReportExportParams): Promise<string> {
    switch (type) {
      case REPORT_TYPE_TRIAL_BALANCE:
        return this.trialBalanceCsv(organizationId, params);
      case REPORT_TYPE_PROFIT_AND_LOSS:
        return this.profitAndLossCsv(organizationId, params);
      case REPORT_TYPE_BALANCE_SHEET:
        return this.balanceSheetCsv(organizationId, params);
      case REPORT_TYPE_GENERAL_LEDGER:
        return this.generalLedgerCsv(organizationId, params);
      default:
        throw new Error(`No financial generator for report type: ${type}`);
    }
  }

  private async trialBalanceCsv(organizationId: string, params: ReportExportParams) {
    const asOf = parseReportDate(params.asOf ?? params.to, new Date());
    const balances = await this.accountBalancesThrough(organizationId, asOf);
    const rows = balances
      .filter((b) => b.debit > 0 || b.credit > 0)
      .map((b) => [b.code, b.name, b.type, b.debit, b.credit]);
    return toCsv(["code", "name", "type", "debit", "credit"], rows);
  }

  private async profitAndLossCsv(organizationId: string, params: ReportExportParams) {
    const to = parseReportDate(params.to, new Date());
    const from = parseReportDate(
      params.from,
      new Date(to.getFullYear(), to.getMonth(), 1),
    );
    const balances = await this.accountBalancesInRange(organizationId, from, to);
    const rows = balances
      .filter(
        (b) =>
          (b.type === AccountType.REVENUE || b.type === AccountType.EXPENSE) &&
          (b.debit > 0 || b.credit > 0),
      )
      .map((b) => {
        const amount =
          b.type === AccountType.REVENUE
            ? roundMoney(b.credit - b.debit)
            : roundMoney(b.debit - b.credit);
        return [b.code, b.name, b.type, amount];
      });
    return toCsv(["code", "name", "type", "amount"], rows);
  }

  private async balanceSheetCsv(organizationId: string, params: ReportExportParams) {
    const asOf = parseReportDate(params.asOf ?? params.to, new Date());
    const balances = await this.accountBalancesThrough(organizationId, asOf);
    const rows = balances
      .filter(
        (b) =>
          (b.type === AccountType.ASSET ||
            b.type === AccountType.LIABILITY ||
            b.type === AccountType.EQUITY) &&
          (b.debit > 0 || b.credit > 0),
      )
      .map((b) => {
        const balance =
          b.type === AccountType.ASSET
            ? roundMoney(b.debit - b.credit)
            : roundMoney(b.credit - b.debit);
        return [b.code, b.name, b.type, balance];
      });
    return toCsv(["code", "name", "type", "balance"], rows);
  }

  private async generalLedgerCsv(organizationId: string, params: ReportExportParams) {
    if (!params.accountCode?.trim()) {
      throw new Error("accountCode is required for general ledger export");
    }
    const account = await this.prisma.account.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code: params.accountCode.trim(),
        },
      },
    });
    if (!account) throw new Error(`Account not found: ${params.accountCode}`);

    const to = parseReportDate(params.to, new Date());
    const from = parseReportDate(
      params.from,
      new Date(to.getFullYear(), to.getMonth(), 1),
    );

    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: {
          organizationId,
          createdAt: { gte: from, lte: to },
        },
      },
      include: { journalEntry: true },
      orderBy: { journalEntry: { createdAt: "asc" } },
    });

    return toCsv(
      ["date", "description", "referenceType", "referenceId", "debit", "credit"],
      lines.map((l) => [
        l.journalEntry.createdAt.toISOString(),
        l.journalEntry.description ?? "",
        l.journalEntry.referenceType ?? "",
        l.journalEntry.referenceId ?? "",
        toNumber(l.debit),
        toNumber(l.credit),
      ]),
    );
  }

  private async accountBalancesThrough(
    organizationId: string,
    asOf: Date,
  ): Promise<AccountBalance[]> {
    const end = new Date(asOf);
    end.setHours(23, 59, 59, 999);
    return this.aggregateBalances(organizationId, { lte: end });
  }

  private async accountBalancesInRange(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<AccountBalance[]> {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    return this.aggregateBalances(organizationId, { gte: start, lte: end });
  }

  private async aggregateBalances(
    organizationId: string,
    createdAt: { gte?: Date; lte?: Date },
  ): Promise<AccountBalance[]> {
    const accounts = await this.prisma.account.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
    });
    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: { organizationId, createdAt },
      },
      select: { accountId: true, debit: true, credit: true },
    });

    const totals = new Map<string, { debit: number; credit: number }>();
    for (const line of lines) {
      const current = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
      current.debit += toNumber(line.debit);
      current.credit += toNumber(line.credit);
      totals.set(line.accountId, current);
    }

    return accounts.map((account) => {
      const t = totals.get(account.id) ?? { debit: 0, credit: 0 };
      return {
        code: account.code,
        name: account.name,
        type: account.type,
        debit: roundMoney(t.debit),
        credit: roundMoney(t.credit),
      };
    });
  }
}

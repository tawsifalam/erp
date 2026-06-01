import { BadRequestException, Injectable } from "@nestjs/common";
import { AccountType } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { AuditAction, AuditEntityType } from "../audit/audit.constants";
import { AuditService } from "../audit/audit.service";
import { roundMoney, generatePrefixedId } from "@erp/utils";

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

  listJournalEntries(organizationId: string) {
    return this.prisma.journalEntry.findMany({
      where: { organizationId },
      include: { lines: { include: { account: true } } },
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

    const entry = await this.prisma.journalEntry.create({
      data: {
        organizationId: params.organizationId,
        description: params.description,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        lines: {
          create: params.lines.map((l) => ({
            id: generatePrefixedId("jl"),
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
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
      },
    });

    return entry;
  }

  async getAccountByCode(organizationId: string, code: string) {
    return this.prisma.account.findUnique({
      where: { organizationId_code: { organizationId, code } },
    });
  }
}

import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { roundMoney } from "@erp/utils";

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  listAccounts(organizationId: string) {
    return this.prisma.account.findMany({ where: { organizationId } });
  }

  createAccount(
    organizationId: string,
    data: { code: string; name: string; type: string },
  ) {
    return this.prisma.account.create({
      data: {
        organizationId,
        code: data.code,
        name: data.name,
        type: data.type as never,
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

    return this.prisma.journalEntry.create({
      data: {
        organizationId: params.organizationId,
        description: params.description,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        lines: {
          create: params.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });
  }

  async getAccountByCode(organizationId: string, code: string) {
    return this.prisma.account.findUnique({
      where: { organizationId_code: { organizationId, code } },
    });
  }
}

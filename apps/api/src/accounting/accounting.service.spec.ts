import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AccountingService } from "./accounting.service";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantScopeService } from "../common/tenant/tenant-scope.service";

jest.mock("@erp/utils", () => ({
  roundMoney: (v: number) => Math.round(v * 100) / 100,
  generatePrefixedId: () => "jl_test",
  toNumber: (v: unknown) => Number(v),
}));

const mockAudit = { record: jest.fn().mockResolvedValue(undefined) };

const mockTenantScope = {
  assertAccountsInOrganization: jest.fn().mockResolvedValue(undefined),
};

const openPeriod = {
  id: "fp-1",
  organizationId: "org-1",
  name: "FY 2026",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-12-31"),
  status: "OPEN",
};

const mockPrisma = {
  account: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  fiscalPeriod: {
    findMany: jest.fn().mockResolvedValue([openPeriod]),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  journalEntry: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe("AccountingService", () => {
  let service: AccountingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: TenantScopeService, useValue: mockTenantScope },
      ],
    }).compile();

    service = module.get<AccountingService>(AccountingService);
  });

  describe("createJournalEntry", () => {
    it("throws when totalDebit !== totalCredit", async () => {
      await expect(
        service.createJournalEntry({
          organizationId: "org-1",
          lines: [
            { accountId: "acc-1", debit: 100, credit: 0 },
            { accountId: "acc-2", debit: 0, credit: 50 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws when less than 2 lines provided", async () => {
      await expect(
        service.createJournalEntry({
          organizationId: "org-1",
          lines: [{ accountId: "acc-1", debit: 100, credit: 100 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws with descriptive message for unbalanced entry", async () => {
      await expect(
        service.createJournalEntry({
          organizationId: "org-1",
          lines: [
            { accountId: "acc-1", debit: 100, credit: 0 },
            { accountId: "acc-2", debit: 0, credit: 99 },
          ],
        }),
      ).rejects.toThrow(/not balanced/i);
    });

    it("throws when no fiscal period covers entry date", async () => {
      mockPrisma.fiscalPeriod.findMany.mockResolvedValueOnce([]);

      await expect(
        service.createJournalEntry({
          organizationId: "org-1",
          lines: [
            { accountId: "acc-1", debit: 100, credit: 0 },
            { accountId: "acc-2", debit: 0, credit: 100 },
          ],
        }),
      ).rejects.toThrow(/No fiscal period covers/i);
    });

    it("throws when fiscal period is closed", async () => {
      mockPrisma.fiscalPeriod.findMany.mockResolvedValueOnce([
        { ...openPeriod, status: "CLOSED" },
      ]);

      await expect(
        service.createJournalEntry({
          organizationId: "org-1",
          lines: [
            { accountId: "acc-1", debit: 100, credit: 0 },
            { accountId: "acc-2", debit: 0, credit: 100 },
          ],
        }),
      ).rejects.toThrow(/is closed/i);
    });

    it("throws when accountId belongs to another organization", async () => {
      mockTenantScope.assertAccountsInOrganization.mockRejectedValueOnce(
        new NotFoundException("Account not found"),
      );

      await expect(
        service.createJournalEntry({
          organizationId: "org-1",
          lines: [
            { accountId: "acc-foreign", debit: 100, credit: 0 },
            { accountId: "acc-2", debit: 0, credit: 100 },
          ],
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it("succeeds with balanced lines", async () => {
      const created = { id: "je-1", lines: [] };
      mockPrisma.journalEntry.create.mockResolvedValue(created);

      const result = await service.createJournalEntry({
        organizationId: "org-1",
        lines: [
          { accountId: "acc-1", debit: 100, credit: 0 },
          { accountId: "acc-2", debit: 0, credit: 100 },
        ],
        description: "Test entry",
      });

      expect(result).toEqual(created);
      expect(mockTenantScope.assertAccountsInOrganization).toHaveBeenCalledWith("org-1", [
        "acc-1",
        "acc-2",
      ]);
      expect(mockPrisma.journalEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: "org-1",
          description: "Test entry",
          fiscalPeriodId: "fp-1",
          lines: {
            create: [
              { id: "jl_test", accountId: "acc-1", debit: 100, credit: 0 },
              { id: "jl_test", accountId: "acc-2", debit: 0, credit: 100 },
            ],
          },
        }),
        include: expect.any(Object),
      });
    });

    it("passes referenceType and referenceId", async () => {
      mockPrisma.journalEntry.create.mockResolvedValue({ id: "je-1" });

      await service.createJournalEntry({
        organizationId: "org-1",
        lines: [
          { accountId: "acc-1", debit: 50, credit: 0 },
          { accountId: "acc-2", debit: 0, credit: 50 },
        ],
        referenceType: "Invoice",
        referenceId: "inv-1",
      });

      expect(mockPrisma.journalEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          referenceType: "Invoice",
          referenceId: "inv-1",
        }),
        include: expect.any(Object),
      });
    });

    it("handles floating-point rounding", async () => {
      mockPrisma.journalEntry.create.mockResolvedValue({ id: "je-1" });

      await expect(
        service.createJournalEntry({
          organizationId: "org-1",
          lines: [
            { accountId: "acc-1", debit: 33.33, credit: 0 },
            { accountId: "acc-2", debit: 33.33, credit: 0 },
            { accountId: "acc-3", debit: 33.34, credit: 0 },
            { accountId: "acc-4", debit: 0, credit: 100 },
          ],
        }),
      ).resolves.toBeDefined();
    });
  });

  describe("listAccounts", () => {
    it("queries accounts by organizationId", async () => {
      const accounts = [{ id: "a1", code: "1000" }];
      mockPrisma.account.findMany.mockResolvedValue(accounts);

      const result = await service.listAccounts("org-1");

      expect(result).toEqual(accounts);
      expect(mockPrisma.account.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
      });
    });
  });

  describe("createAccount", () => {
    it("throws when code is empty", () => {
      expect(() =>
        service.createAccount("org-1", { code: "  ", name: "Cash", type: "ASSET" }),
      ).toThrow(BadRequestException);
    });

    it("throws when type is invalid", () => {
      expect(() =>
        service.createAccount("org-1", { code: "9999", name: "Bad", type: "INVALID" }),
      ).toThrow(BadRequestException);
    });

    it("creates account with correct data", async () => {
      const account = { id: "a1", code: "1000", name: "Cash", type: "ASSET" };
      mockPrisma.account.create.mockResolvedValue(account);

      const result = await service.createAccount("org-1", {
        code: "1000",
        name: "Cash",
        type: "ASSET",
      });

      expect(result).toEqual(account);
      expect(mockPrisma.account.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          code: "1000",
          name: "Cash",
          type: "ASSET",
        },
      });
    });
  });

  describe("listJournalEntries", () => {
    it("queries entries with lines and accounts included", async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);

      await service.listJournalEntries("org-1");

      expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        include: expect.objectContaining({
          lines: { include: { account: true } },
        }),
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    });
  });

  describe("getAccountByCode", () => {
    it("looks up account by composite key", async () => {
      const account = { id: "a1", code: "1000" };
      mockPrisma.account.findUnique.mockResolvedValue(account);

      const result = await service.getAccountByCode("org-1", "1000");

      expect(result).toEqual(account);
      expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
        where: { organizationId_code: { organizationId: "org-1", code: "1000" } },
      });
    });
  });

  describe("reverseJournalEntry", () => {
    const original = {
      id: "je-original",
      organizationId: "org-1",
      description: "Utility bill",
      reversesEntryId: null,
      reversedAt: null,
      lines: [
        { accountId: "acc-1", debit: 500, credit: 0, account: { name: "Utilities" } },
        { accountId: "acc-2", debit: 0, credit: 500, account: { name: "Bank" } },
      ],
    };

    it("rejects reversing an already reversed entry", async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...original,
        reversedAt: new Date(),
      });

      await expect(
        service.reverseJournalEntry("org-1", "je-original"),
      ).rejects.toThrow(/already been reversed/i);
    });

    it("creates offsetting entry and marks original reversed", async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(original);
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: "je-reversal",
        description: "Reversal of: Utility bill",
        lines: [],
      });

      await service.reverseJournalEntry("org-1", "je-original", "user-1");

      expect(mockPrisma.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reversesEntryId: "je-original",
            referenceType: "journal_reversal",
            lines: {
              create: [
                expect.objectContaining({ accountId: "acc-1", debit: 0, credit: 500 }),
                expect.objectContaining({ accountId: "acc-2", debit: 500, credit: 0 }),
              ],
            },
          }),
        }),
      );
      expect(mockPrisma.journalEntry.update).toHaveBeenCalledWith({
        where: { id: "je-original" },
        data: expect.objectContaining({ reversedAt: expect.any(Date) }),
      });
      expect(mockAudit.record).toHaveBeenCalled();
    });
  });
});

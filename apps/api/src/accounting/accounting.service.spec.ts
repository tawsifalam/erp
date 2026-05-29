import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { AccountingService } from "./accounting.service";
import { PrismaService } from "../prisma/prisma.service";

jest.mock("@erp/utils", () => ({
  roundMoney: (v: number) => Math.round(v * 100) / 100,
}));

const mockPrisma = {
  account: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  journalEntry: {
    findMany: jest.fn(),
    create: jest.fn(),
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
      expect(mockPrisma.journalEntry.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          description: "Test entry",
          referenceType: undefined,
          referenceId: undefined,
          lines: {
            create: [
              { accountId: "acc-1", debit: 100, credit: 0 },
              { accountId: "acc-2", debit: 0, credit: 100 },
            ],
          },
        },
        include: { lines: { include: { account: true } } },
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
        include: { lines: { include: { account: true } } },
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
});

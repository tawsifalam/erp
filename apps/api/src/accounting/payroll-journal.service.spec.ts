import { Test, TestingModule } from "@nestjs/testing";
import { PayrollJournalService } from "./payroll-journal.service";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingService } from "./accounting.service";

jest.mock("@erp/utils", () => ({
  toNumber: (v: unknown) => Number(v),
  roundMoney: (v: number) => Math.round(v * 100) / 100,
}));

const mockPrisma = {
  payrollLine: { findMany: jest.fn() },
  journalEntry: { findFirst: jest.fn() },
};

const mockAccounting = {
  getAccountByCode: jest.fn(),
  createJournalEntry: jest.fn(),
};

describe("PayrollJournalService", () => {
  let service: PayrollJournalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollJournalService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AccountingService, useValue: mockAccounting },
      ],
    }).compile();
    service = module.get(PayrollJournalService);
  });

  it("posts balanced journal for gross, net, and deductions", async () => {
    mockPrisma.payrollLine.findMany.mockResolvedValue([
      { grossPay: 45000, netPay: 44900, deductions: 100 },
      { grossPay: 30000, netPay: 30000, deductions: 0 },
    ]);
    mockPrisma.journalEntry.findFirst.mockResolvedValue(null);
    mockAccounting.getAccountByCode.mockImplementation((_org: string, code: string) => {
      const map: Record<string, { id: string }> = {
        "5100": { id: "exp" },
        "2100": { id: "pay" },
        "5150": { id: "ded" },
      };
      return map[code] ?? null;
    });

    await service.postPayrollRunJournal("pr-1", "org-1");

    expect(mockAccounting.createJournalEntry).toHaveBeenCalledWith({
      organizationId: "org-1",
      referenceType: "payroll_run",
      referenceId: "pr-1",
      description: "Payroll run pr-1",
      lines: [
        { accountId: "exp", debit: 75000, credit: 0 },
        { accountId: "pay", debit: 0, credit: 74900 },
        { accountId: "ded", debit: 0, credit: 100 },
      ],
    });
  });

  it("skips when journal already exists", async () => {
    mockPrisma.payrollLine.findMany.mockResolvedValue([{ grossPay: 1, netPay: 1, deductions: 0 }]);
    mockPrisma.journalEntry.findFirst.mockResolvedValue({ id: "je-1" });

    await service.postPayrollRunJournal("pr-1", "org-1");

    expect(mockAccounting.createJournalEntry).not.toHaveBeenCalled();
  });
});

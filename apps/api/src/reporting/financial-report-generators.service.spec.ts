import { Test, TestingModule } from "@nestjs/testing";
import { AccountType } from "@erp/types";
import { FinancialReportGeneratorsService } from "./financial-report-generators.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
  account: { findMany: jest.fn(), findUnique: jest.fn() },
  journalLine: { findMany: jest.fn() },
};

describe("FinancialReportGeneratorsService", () => {
  let service: FinancialReportGeneratorsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialReportGeneratorsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(FinancialReportGeneratorsService);
  });

  it("generatePdf produces PDF for trial balance", async () => {
    mockPrisma.account.findMany.mockResolvedValue([
      { id: "a1", code: "5200", name: "Utilities", type: AccountType.EXPENSE },
      { id: "a2", code: "1100", name: "Bank", type: AccountType.ASSET },
    ]);
    mockPrisma.journalLine.findMany.mockResolvedValue([
      { accountId: "a1", debit: 100, credit: 0 },
      { accountId: "a2", debit: 0, credit: 100 },
    ]);

    const pdf = await service.generatePdf("trial_balance", "org-1", {
      asOf: "2026-05-31",
    });

    expect(pdf.toString("utf8").startsWith("%PDF-1.4")).toBe(true);
  });

  it("generate returns CSV for profit and loss", async () => {
    mockPrisma.account.findMany.mockResolvedValue([
      { id: "a1", code: "4000", name: "Revenue", type: AccountType.REVENUE },
    ]);
    mockPrisma.journalLine.findMany.mockResolvedValue([
      { accountId: "a1", debit: 0, credit: 500 },
    ]);

    const csv = await service.generate("profit_and_loss", "org-1", {
      from: "2026-05-01",
      to: "2026-05-31",
    });

    expect(csv).toContain("code,name,type,amount");
    expect(csv).toContain("4000");
  });
});

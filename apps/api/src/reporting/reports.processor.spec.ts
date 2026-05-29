import { Test, TestingModule } from "@nestjs/testing";
import { ReportsProcessor } from "./reports.processor";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { ReportGeneratorsService } from "./report-generators.service";

const mockPrisma = {
  reportJob: { findUnique: jest.fn(), update: jest.fn() },
};

const mockStorage = {
  upload: jest.fn(),
};

const mockGenerators = {
  generate: jest.fn(),
};

describe("ReportsProcessor", () => {
  let processor: ReportsProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: ReportGeneratorsService, useValue: mockGenerators },
      ],
    }).compile();
    processor = module.get(ReportsProcessor);
  });

  it("generates CSV and marks job COMPLETED", async () => {
    mockPrisma.reportJob.findUnique.mockResolvedValue({
      id: "rpt-1",
      type: "branch_summary",
      branchId: "branch-1",
    });
    mockGenerators.generate.mockResolvedValue("metric,value\noccupancyPct,20\n");
    mockStorage.upload.mockResolvedValue({ url: "https://storage/report.csv", key: "reports/rpt-1.csv" });

    await processor.process({ data: { reportJobId: "rpt-1" } } as never);

    expect(mockPrisma.reportJob.update).toHaveBeenCalledWith({
      where: { id: "rpt-1" },
      data: { status: "PROCESSING", errorMessage: null },
    });
    expect(mockGenerators.generate).toHaveBeenCalledWith("branch_summary", "branch-1");
    expect(mockPrisma.reportJob.update).toHaveBeenLastCalledWith({
      where: { id: "rpt-1" },
      data: {
        status: "COMPLETED",
        fileUrl: "https://storage/report.csv",
        completedAt: expect.any(Date),
        errorMessage: null,
      },
    });
  });

  it("marks job FAILED on generator error", async () => {
    mockPrisma.reportJob.findUnique.mockResolvedValue({
      id: "rpt-2",
      type: "low_stock",
      branchId: "branch-1",
    });
    mockGenerators.generate.mockRejectedValue(new Error("boom"));

    await processor.process({ data: { reportJobId: "rpt-2" } } as never);

    expect(mockPrisma.reportJob.update).toHaveBeenLastCalledWith({
      where: { id: "rpt-2" },
      data: {
        status: "FAILED",
        errorMessage: "boom",
        completedAt: expect.any(Date),
      },
    });
  });
});

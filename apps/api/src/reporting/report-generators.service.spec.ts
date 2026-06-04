import { Test, TestingModule } from "@nestjs/testing";
import { ReportGeneratorsService } from "./report-generators.service";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import {
  REPORT_TYPE_BRANCH_SUMMARY,
  REPORT_TYPE_LOW_STOCK,
  REPORT_TYPE_REVENUE_TODAY,
} from "./reporting.constants";

const mockPrisma = {
  room: { count: jest.fn() },
  reservation: { count: jest.fn() },
  order: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockInventory = {
  listItemsWithStock: jest.fn(),
};

describe("ReportGeneratorsService", () => {
  let service: ReportGeneratorsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportGeneratorsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventory },
      ],
    }).compile();
    service = module.get(ReportGeneratorsService);
  });

  it("generate throws for unknown report type", async () => {
    await expect(service.generate("unknown_type", "branch-1")).rejects.toThrow(
      /No generator/,
    );
  });

  it("branchSummaryCsv includes occupancy and low stock metrics", async () => {
    mockPrisma.room.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3);
    mockPrisma.reservation.count.mockResolvedValue(5);
    mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 1250 } });
    mockInventory.listItemsWithStock.mockResolvedValue([
      { lowStockThreshold: 5, currentStock: 2 },
      { lowStockThreshold: null, currentStock: 100 },
    ]);

    const csv = await service.generate(REPORT_TYPE_BRANCH_SUMMARY, "branch-1");

    expect(csv).toContain("occupancyPct");
    expect(csv).toContain("30");
    expect(csv).toContain("lowStockAlerts");
    expect(csv).toContain("1");
  });

  it("lowStockCsv lists only items at or below threshold", async () => {
    mockInventory.listItemsWithStock.mockResolvedValue([
      {
        sku: "OIL-1",
        name: "Cooking Oil",
        unit: "L",
        pool: { name: "Guest" },
        currentStock: 2,
        lowStockThreshold: 5,
      },
      {
        sku: "RICE-1",
        name: "Rice",
        unit: "kg",
        pool: null,
        currentStock: 50,
        lowStockThreshold: 10,
      },
    ]);

    const csv = await service.generate(REPORT_TYPE_LOW_STOCK, "branch-1");

    expect(csv).toContain("OIL-1");
    expect(csv).not.toContain("RICE-1");
  });

  it("revenueTodayCsv includes completed orders", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: "ord_1",
        tableNumber: "T3",
        totalAmount: 45,
        paidAmount: 45,
        paymentStatus: "PAID",
        createdAt: new Date("2026-06-04T12:00:00Z"),
      },
    ]);

    const csv = await service.generate(REPORT_TYPE_REVENUE_TODAY, "branch-1");

    expect(csv).toContain("orderId");
    expect(csv).toContain("ord_1");
    expect(csv).toContain("T3");
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { ReportingService } from "./reporting.service";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";

const mockPrisma = {
  room: { count: jest.fn() },
  reservation: { count: jest.fn() },
  order: { aggregate: jest.fn() },
  reportJob: { create: jest.fn(), findMany: jest.fn() },
};

const mockInventory = {
  listItemsWithStock: jest.fn(),
};

describe("ReportingService", () => {
  let service: ReportingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.room.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2);
    mockPrisma.reservation.count.mockResolvedValue(3);
    mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 690 } });
    mockInventory.listItemsWithStock.mockResolvedValue([
      {
        id: "inv-1",
        sku: "RICE",
        name: "Rice",
        unit: "kg",
        currentStock: 5,
        lowStockThreshold: 10,
        pool: { code: "guest", name: "Guest / Kitchen" },
      },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventory },
      ],
    }).compile();

    service = module.get(ReportingService);
  });

  describe("dashboard", () => {
    it("returns occupancy from OCCUPIED rooms and low stock items", async () => {
      const result = await service.dashboard("org-1", "branch-1");

      expect(result.occupancyPct).toBe(20);
      expect(result.activeReservations).toBe(3);
      expect(result.revenueToday).toBe(690);
      expect(result.lowStockAlerts).toBe(1);
      expect(result.lowStockItems).toHaveLength(1);
    });
  });

  describe("requestExport", () => {
    it("creates job for branch_summary with branchId", async () => {
      mockPrisma.reportJob.create.mockResolvedValue({ id: "rpt-1" });

      await expect(
        service.requestExport("org-1", "branch_summary", "branch-1"),
      ).resolves.toEqual({ id: "rpt-1" });

      expect(mockPrisma.reportJob.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          branchId: "branch-1",
          requestedByUserId: null,
          type: "branch_summary",
          status: "PENDING",
          params: undefined,
        },
      });
    });

    it("accepts summary alias", async () => {
      mockPrisma.reportJob.create.mockResolvedValue({ id: "rpt-1" });
      await service.requestExport("org-1", "summary", "branch-1");
      expect(mockPrisma.reportJob.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: "branch_summary" }) }),
      );
    });

    it("throws for unknown type", () => {
      expect(() => service.requestExport("org-1", "unknown", "branch-1")).toThrow(
        BadRequestException,
      );
    });

    it("throws when branchId missing for branch-scoped report", () => {
      expect(() => service.requestExport("org-1", "low_stock")).toThrow(BadRequestException);
    });

    it("stores pdf format for financial reports", async () => {
      mockPrisma.reportJob.create.mockResolvedValue({ id: "rpt-pdf" });

      await service.requestExport("org-1", "trial_balance", undefined, {
        asOf: "2026-05-31",
        format: "pdf",
      });

      expect(mockPrisma.reportJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "trial_balance",
          params: expect.objectContaining({ format: "pdf", asOf: "2026-05-31" }),
        }),
      });
    });

    it("rejects pdf format for branch reports", () => {
      expect(() =>
        service.requestExport("org-1", "branch_summary", "branch-1", { format: "pdf" }),
      ).toThrow(BadRequestException);
    });
  });

  describe("listReportTypes", () => {
    it("returns catalog with labels", () => {
      const types = service.listReportTypes();
      expect(types.map((t) => t.code)).toEqual(
        expect.arrayContaining([
          "branch_summary",
          "low_stock",
          "revenue_today",
          "trial_balance",
          "profit_and_loss",
          "balance_sheet",
          "general_ledger",
        ]),
      );
      expect(types).toHaveLength(7);
    });
  });
});

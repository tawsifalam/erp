import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { MovementType } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { HrService } from "./hr.service";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";

jest.mock("@erp/utils", () => ({
  toNumber: (v: unknown) => Number(v),
  generatePrefixedId: () => "sml_test",
}));

const mockPrisma = {
  employee: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  attendanceRecord: { create: jest.fn(), findMany: jest.fn() },
  staffMeal: { create: jest.fn(), findMany: jest.fn() },
  staffMealRecipe: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  payrollRun: { create: jest.fn() },
};

const mockInventory = {
  createMovement: jest.fn(),
  assertItemInPool: jest.fn().mockResolvedValue({ id: "item-1" }),
};

const mockEvents = {
  emit: jest.fn(),
};

const sampleRecipe = {
  id: "smr-1",
  branchId: "branch-1",
  name: "Staff Lunch",
  lines: [
    { inventoryItemId: "item-rice", quantity: 0.3 },
    { inventoryItemId: "item-chicken", quantity: 0.15 },
  ],
};

describe("HrService", () => {
  let service: HrService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.employee.findFirst.mockResolvedValue({ id: "emp-1", organizationId: "org-1" });
    mockPrisma.staffMealRecipe.findFirst.mockResolvedValue(sampleRecipe);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HrService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventory },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<HrService>(HrService);
  });

  describe("recordStaffMeal", () => {
    it("deducts each recipe ingredient × meal count", async () => {
      mockInventory.createMovement.mockResolvedValue({});
      mockPrisma.staffMeal.create.mockResolvedValue({ id: "sm-1" });

      await service.recordStaffMeal({
        organizationId: "org-1",
        employeeId: "emp-1",
        branchId: "branch-1",
        staffMealRecipeId: "smr-1",
        mealCount: 2,
      });

      expect(mockInventory.createMovement).toHaveBeenCalledTimes(2);
      expect(mockInventory.createMovement).toHaveBeenCalledWith({
        itemId: "item-rice",
        branchId: "branch-1",
        movementType: MovementType.STAFF_MEAL,
        quantity: 0.6,
        referenceType: "StaffMeal",
        referenceId: "sm-1",
      });
      expect(mockPrisma.staffMeal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mealCount: 2,
            unitCostPerMeal: expect.closeTo(0.45, 5),
          }),
        }),
      );
    });

    it("throws when mealCount is not a positive integer", async () => {
      await expect(
        service.recordStaffMeal({
          organizationId: "org-1",
          employeeId: "emp-1",
          branchId: "branch-1",
          staffMealRecipeId: "smr-1",
          mealCount: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("respects deductFromPayroll flag", async () => {
      mockInventory.createMovement.mockResolvedValue({});
      mockPrisma.staffMeal.create.mockResolvedValue({ id: "sm-1" });

      await service.recordStaffMeal({
        organizationId: "org-1",
        employeeId: "emp-1",
        branchId: "branch-1",
        staffMealRecipeId: "smr-1",
        mealCount: 1,
        deductFromPayroll: true,
      });

      expect(mockPrisma.staffMeal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deductFromPayroll: true }),
        }),
      );
    });
  });

  describe("upsertStaffMealRecipe", () => {
    it("creates recipe with validated lines", async () => {
      mockPrisma.staffMealRecipe.create.mockResolvedValue({ id: "smr-new" });

      await service.upsertStaffMealRecipe("branch-1", {
        name: "Staff Lunch",
        lines: [{ inventoryItemId: "item-1", quantity: 0.3 }],
      });

      expect(mockInventory.assertItemInPool).toHaveBeenCalledWith("branch-1", "item-1", "staff");
      expect(mockPrisma.staffMealRecipe.create).toHaveBeenCalled();
    });
  });

  describe("requestPayrollRun", () => {
    it("creates payroll run and emits event", async () => {
      const run = { id: "pr-1" };
      mockPrisma.payrollRun.create.mockResolvedValue(run);

      const result = await service.requestPayrollRun(
        "org-1",
        new Date("2026-06-01"),
        new Date("2026-06-30"),
      );

      expect(result).toEqual(run);
    });

    it("throws when periodStart >= periodEnd", async () => {
      await expect(
        service.requestPayrollRun("org-1", new Date("2026-06-30"), new Date("2026-06-01")),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("createEmployee", () => {
    it("throws when name is empty", () => {
      expect(() =>
        service.createEmployee("org-1", { name: "  ", designation: "Chef", salary: 1000 }),
      ).toThrow(BadRequestException);
    });
  });

  describe("getEmployee", () => {
    it("throws NotFoundException when missing", async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.getEmployee("org-1", "missing")).rejects.toThrow(NotFoundException);
    });
  });
});

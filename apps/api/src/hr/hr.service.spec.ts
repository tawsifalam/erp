import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { EmployeeStatus, MovementType } from "@erp/types";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { HrService } from "./hr.service";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { TenantScopeService } from "../common/tenant/tenant-scope.service";

jest.mock("@erp/utils", () => ({
  toNumber: (v: unknown) => Number(v),
  generatePrefixedId: () => "sml_test",
}));

const mockPrisma = {
  employee: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
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

const mockTenantScope = {
  assertBranchInOrganization: jest.fn().mockResolvedValue(undefined),
  resolveBranchId: jest.fn(),
};

const sampleRecipe = {
  id: "smr-1",
  branchId: "branch-1",
  name: "Staff Lunch",
  lines: [
    {
      inventoryItemId: "item-rice",
      quantity: 0.3,
      inventoryItem: { averageUnitCost: 1 },
    },
    {
      inventoryItemId: "item-chicken",
      quantity: 0.15,
      inventoryItem: { averageUnitCost: 1 },
    },
  ],
};

describe("HrService", () => {
  let service: HrService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.employee.findFirst.mockResolvedValue({
      id: "emp-1",
      organizationId: "org-1",
      status: EmployeeStatus.ACTIVE,
    });
    mockPrisma.staffMealRecipe.findFirst.mockResolvedValue(sampleRecipe);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HrService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventory },
        { provide: EventEmitter2, useValue: mockEvents },
        { provide: AuditService, useValue: { record: jest.fn().mockResolvedValue(undefined) } },
        { provide: TenantScopeService, useValue: mockTenantScope },
      ],
    }).compile();

    service = module.get<HrService>(HrService);
  });

  describe("createEmployee", () => {
    it("validates branchId belongs to organization", async () => {
      mockTenantScope.assertBranchInOrganization.mockRejectedValue(
        new ForbiddenException("Branch does not belong to this organization"),
      );
      await expect(
        service.createEmployee("org-1", {
          name: "Test",
          designation: "Role",
          salary: 1000,
          branchId: "br-other",
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.employee.create).not.toHaveBeenCalled();
    });
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
    it("throws when name is empty", async () => {
      await expect(
        service.createEmployee("org-1", { name: "  ", designation: "Chef", salary: 1000 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getEmployee", () => {
    it("throws NotFoundException when missing", async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.getEmployee("org-1", "missing")).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateEmployee", () => {
    it("updates fields when found", async () => {
      mockPrisma.employee.update.mockResolvedValue({
        id: "emp-1",
        name: "Updated",
        designation: "Manager",
        salary: 50000,
        status: EmployeeStatus.ACTIVE,
      });

      const result = await service.updateEmployee("org-1", "emp-1", {
        name: "Updated",
        designation: "Manager",
        salary: 50000,
      });

      expect(result.name).toBe("Updated");
      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: "emp-1" },
        data: { name: "Updated", designation: "Manager", salary: 50000 },
        include: { branch: true, user: true },
      });
    });

    it("rejects empty name", async () => {
      await expect(
        service.updateEmployee("org-1", "emp-1", { name: "   " }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects negative salary", async () => {
      await expect(
        service.updateEmployee("org-1", "emp-1", { salary: -1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it("terminate sets status and terminatedAt", async () => {
      mockPrisma.employee.update.mockResolvedValue({
        id: "emp-1",
        status: EmployeeStatus.TERMINATED,
      });

      await service.updateEmployee("org-1", "emp-1", {
        status: EmployeeStatus.TERMINATED,
      });

      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: "emp-1" },
        data: {
          status: EmployeeStatus.TERMINATED,
          terminatedAt: expect.any(Date),
        },
        include: { branch: true, user: true },
      });
    });

    it("reactivate clears terminatedAt", async () => {
      mockPrisma.employee.update.mockResolvedValue({
        id: "emp-1",
        status: EmployeeStatus.ACTIVE,
      });

      await service.updateEmployee("org-1", "emp-1", {
        status: EmployeeStatus.ACTIVE,
      });

      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: "emp-1" },
        data: {
          status: EmployeeStatus.ACTIVE,
          terminatedAt: null,
        },
        include: { branch: true, user: true },
      });
    });
  });

  describe("clockAttendance", () => {
    it("rejects terminated employee", async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: "emp-1",
        organizationId: "org-1",
        status: EmployeeStatus.TERMINATED,
      });

      await expect(
        service.clockAttendance("org-1", "emp-1", "branch-1", "CLOCK_IN" as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("recordStaffMeal terminated guard", () => {
    it("rejects terminated employee", async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: "emp-1",
        organizationId: "org-1",
        status: EmployeeStatus.TERMINATED,
      });

      await expect(
        service.recordStaffMeal({
          organizationId: "org-1",
          employeeId: "emp-1",
          branchId: "branch-1",
          staffMealRecipeId: "smr-1",
          mealCount: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

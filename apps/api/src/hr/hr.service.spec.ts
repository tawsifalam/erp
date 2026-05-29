import { Test, TestingModule } from "@nestjs/testing";
import { MovementType } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { HrService } from "./hr.service";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";

const mockPrisma = {
  employee: { findMany: jest.fn(), create: jest.fn() },
  attendanceRecord: { create: jest.fn() },
  staffMeal: { create: jest.fn() },
  payrollRun: { create: jest.fn() },
};

const mockInventory = {
  createMovement: jest.fn(),
};

const mockEvents = {
  emit: jest.fn(),
};

describe("HrService", () => {
  let service: HrService;

  beforeEach(async () => {
    jest.clearAllMocks();

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
    it("creates inventory movement with STAFF_MEAL type", async () => {
      mockInventory.createMovement.mockResolvedValue({});
      mockPrisma.staffMeal.create.mockResolvedValue({ id: "sm-1" });

      await service.recordStaffMeal({
        employeeId: "emp-1",
        branchId: "branch-1",
        inventoryItemId: "item-1",
        quantity: 2,
      });

      expect(mockInventory.createMovement).toHaveBeenCalledWith({
        itemId: "item-1",
        branchId: "branch-1",
        movementType: MovementType.STAFF_MEAL,
        quantity: 2,
        referenceType: "StaffMeal",
        referenceId: "emp-1",
      });
    });

    it("creates staff meal record", async () => {
      mockInventory.createMovement.mockResolvedValue({});
      mockPrisma.staffMeal.create.mockResolvedValue({ id: "sm-1" });

      const result = await service.recordStaffMeal({
        employeeId: "emp-1",
        branchId: "branch-1",
        inventoryItemId: "item-1",
        quantity: 2,
      });

      expect(result).toEqual({ id: "sm-1" });
      expect(mockPrisma.staffMeal.create).toHaveBeenCalledWith({
        data: {
          employeeId: "emp-1",
          inventoryItemId: "item-1",
          quantity: 2,
          deductFromPayroll: false,
        },
      });
    });

    it("respects deductFromPayroll flag", async () => {
      mockInventory.createMovement.mockResolvedValue({});
      mockPrisma.staffMeal.create.mockResolvedValue({ id: "sm-1" });

      await service.recordStaffMeal({
        employeeId: "emp-1",
        branchId: "branch-1",
        inventoryItemId: "item-1",
        quantity: 1,
        deductFromPayroll: true,
      });

      expect(mockPrisma.staffMeal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ deductFromPayroll: true }),
      });
    });

    it("calls inventory movement before creating staff meal", async () => {
      const callOrder: string[] = [];
      mockInventory.createMovement.mockImplementation(async () => {
        callOrder.push("movement");
      });
      mockPrisma.staffMeal.create.mockImplementation(async () => {
        callOrder.push("staffMeal");
        return { id: "sm-1" };
      });

      await service.recordStaffMeal({
        employeeId: "emp-1",
        branchId: "branch-1",
        inventoryItemId: "item-1",
        quantity: 1,
      });

      expect(callOrder).toEqual(["movement", "staffMeal"]);
    });
  });

  describe("requestPayrollRun", () => {
    it("creates payroll run and emits event", async () => {
      const run = { id: "pr-1" };
      mockPrisma.payrollRun.create.mockResolvedValue(run);

      const periodStart = new Date("2026-06-01");
      const periodEnd = new Date("2026-06-30");

      const result = await service.requestPayrollRun(
        "org-1",
        periodStart,
        periodEnd,
      );

      expect(result).toEqual(run);
      expect(mockPrisma.payrollRun.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          periodStart,
          periodEnd,
        },
      });
    });

    it("emits payroll.run_requested event with run ID", async () => {
      const run = { id: "pr-1" };
      mockPrisma.payrollRun.create.mockResolvedValue(run);

      await service.requestPayrollRun(
        "org-1",
        new Date("2026-06-01"),
        new Date("2026-06-30"),
      );

      expect(mockEvents.emit).toHaveBeenCalledWith(
        "payroll.run_requested",
        expect.objectContaining({ payrollRunId: "pr-1" }),
      );
    });
  });

  describe("listEmployees", () => {
    it("queries employees with branch and user included", async () => {
      mockPrisma.employee.findMany.mockResolvedValue([]);

      await service.listEmployees("org-1");

      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        include: { branch: true, user: true },
      });
    });
  });

  describe("createEmployee", () => {
    it("creates employee with provided data", async () => {
      const employee = { id: "emp-1", name: "John" };
      mockPrisma.employee.create.mockResolvedValue(employee);

      const result = await service.createEmployee("org-1", {
        name: "John",
        designation: "Chef",
        salary: 5000,
        branchId: "branch-1",
      });

      expect(result).toEqual(employee);
      expect(mockPrisma.employee.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          name: "John",
          designation: "Chef",
          salary: 5000,
          branchId: "branch-1",
        },
      });
    });
  });

  describe("clockAttendance", () => {
    it("creates attendance record", async () => {
      const record = { id: "att-1" };
      mockPrisma.attendanceRecord.create.mockResolvedValue(record);

      const result = await service.clockAttendance(
        "emp-1",
        "branch-1",
        "CLOCK_IN" as any,
      );

      expect(result).toEqual(record);
      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: {
          employeeId: "emp-1",
          branchId: "branch-1",
          type: "CLOCK_IN",
        },
      });
    });
  });
});

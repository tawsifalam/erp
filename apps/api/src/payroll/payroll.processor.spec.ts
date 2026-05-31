import { Test, TestingModule } from "@nestjs/testing";
import { EmployeeStatus, PayrollRunStatus } from "@erp/types";
import { PayrollProcessor, computePayrollLine } from "./payroll.processor";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

jest.mock("@erp/utils", () => ({
  toNumber: (v: unknown) => Number(v),
}));

const mockPrisma = {
  payrollRun: { findUnique: jest.fn(), update: jest.fn() },
  employee: { findMany: jest.fn() },
  staffMeal: { findMany: jest.fn(), updateMany: jest.fn() },
  payrollLine: { create: jest.fn() },
};

const mockStorage = {
  upload: jest.fn(),
};

describe("computePayrollLine", () => {
  it("deducts staff meal costs from net pay", () => {
    expect(computePayrollLine(45000, 150)).toEqual({
      grossPay: 45000,
      deductions: 150,
      netPay: 44850,
    });
  });

  it("caps deductions at gross pay", () => {
    expect(computePayrollLine(100, 500).deductions).toBe(100);
  });
});

describe("PayrollProcessor", () => {
  let processor: PayrollProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();
    processor = module.get(PayrollProcessor);
  });

  it("creates payroll lines with staff meal deductions", async () => {
    mockPrisma.payrollRun.findUnique.mockResolvedValue({
      id: "pr-1",
      organizationId: "org-1",
    });
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: "emp-1", salary: 45000 },
    ]);
    mockPrisma.staffMeal.findMany.mockResolvedValue([
      { id: "sm-1", mealCount: 2, unitCostPerMeal: 50, deductFromPayroll: true },
    ]);

    await processor.process({ data: { payrollRunId: "pr-1" } } as never);

    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", status: EmployeeStatus.ACTIVE },
    });
    expect(mockPrisma.payrollLine.create).toHaveBeenCalledWith({
      data: {
        payrollRunId: "pr-1",
        employeeId: "emp-1",
        grossPay: 45000,
        deductions: 100,
        netPay: 44900,
      },
    });
    expect(mockPrisma.staffMeal.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["sm-1"] } },
      data: { payrollDeducted: true },
    });
    expect(mockPrisma.payrollRun.update).toHaveBeenLastCalledWith({
      where: { id: "pr-1" },
      data: {
        status: PayrollRunStatus.COMPLETED,
        completedAt: expect.any(Date),
      },
    });
  });
});

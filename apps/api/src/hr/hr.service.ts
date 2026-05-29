import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AttendanceType, MovementType } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { PayrollRunRequestedEvent } from "../common/events/payroll-run-requested.event";
import { toNumber, generatePrefixedId } from "@erp/utils";
import { computeStaffMealUnitCost } from "./hr.constants";
import { POOL_CODE_STAFF } from "../inventory/inventory.constants";

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly events: EventEmitter2,
  ) {}

  listEmployees(organizationId: string) {
    return this.prisma.employee.findMany({
      where: { organizationId },
      include: { branch: true, user: true },
      orderBy: { name: "asc" },
    });
  }

  async getEmployee(organizationId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
    });
    if (!employee) throw new NotFoundException("Employee not found");
    return employee;
  }

  createEmployee(
    organizationId: string,
    data: {
      name: string;
      designation: string;
      salary: number;
      userId?: string;
      branchId?: string;
    },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("Employee name is required");
    if (!data.designation?.trim()) {
      throw new BadRequestException("Designation is required");
    }
    if (data.salary < 0) throw new BadRequestException("Salary cannot be negative");

    return this.prisma.employee.create({
      data: {
        organizationId,
        name: data.name.trim(),
        designation: data.designation.trim(),
        salary: data.salary,
        userId: data.userId,
        branchId: data.branchId,
      },
    });
  }

  async clockAttendance(employeeId: string, branchId: string, type: AttendanceType) {
    if (!branchId) throw new BadRequestException("Branch is required for attendance");
    return this.prisma.attendanceRecord.create({
      data: { employeeId, branchId, type },
    });
  }

  listAttendance(branchId: string, limit = 50) {
    return this.prisma.attendanceRecord.findMany({
      where: { branchId },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { recordedAt: "desc" },
      take: limit,
    });
  }

  listStaffMealRecipes(branchId: string) {
    return this.prisma.staffMealRecipe.findMany({
      where: { branchId },
      include: {
        lines: { include: { inventoryItem: { select: { id: true, name: true, unit: true } } } },
      },
      orderBy: { name: "asc" },
    });
  }

  async upsertStaffMealRecipe(
    branchId: string,
    data: {
      id?: string;
      name: string;
      lines: { inventoryItemId: string; quantity: number }[];
    },
  ) {
    if (!branchId) throw new BadRequestException("Branch is required");
    if (!data.name?.trim()) throw new BadRequestException("Recipe name is required");

    const lines = data.lines.filter((l) => l.inventoryItemId && l.quantity > 0);
    if (lines.length === 0) {
      throw new BadRequestException("At least one recipe line is required");
    }

    for (const line of lines) {
      await this.inventory.assertItemInPool(
        branchId,
        line.inventoryItemId,
        POOL_CODE_STAFF,
      );
    }

    const lineCreates = lines.map((l) => ({
      id: generatePrefixedId("sml"),
      inventoryItemId: l.inventoryItemId,
      quantity: l.quantity,
    }));

    if (data.id) {
      const existing = await this.prisma.staffMealRecipe.findFirst({
        where: { id: data.id, branchId },
      });
      if (!existing) throw new NotFoundException("Staff meal recipe not found");

      return this.prisma.staffMealRecipe.update({
        where: { id: data.id },
        data: {
          name: data.name.trim(),
          lines: {
            deleteMany: {},
            create: lineCreates,
          },
        },
        include: {
          lines: { include: { inventoryItem: { select: { id: true, name: true, unit: true } } } },
        },
      });
    }

    return this.prisma.staffMealRecipe.create({
      data: {
        branchId,
        name: data.name.trim(),
        lines: { create: lineCreates },
      },
      include: {
        lines: { include: { inventoryItem: { select: { id: true, name: true, unit: true } } } },
      },
    });
  }

  async getStaffMealRecipe(branchId: string, recipeId: string) {
    const recipe = await this.prisma.staffMealRecipe.findFirst({
      where: { id: recipeId, branchId },
      include: { lines: true },
    });
    if (!recipe) throw new NotFoundException("Staff meal recipe not found");
    if (recipe.lines.length === 0) {
      throw new BadRequestException("Staff meal recipe has no ingredients");
    }
    return recipe;
  }

  listStaffMeals(branchId: string, limit = 50) {
    return this.prisma.staffMeal.findMany({
      where: { branchId },
      include: {
        employee: { select: { id: true, name: true } },
        recipe: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async recordStaffMeal(params: {
    organizationId: string;
    employeeId: string;
    branchId: string;
    staffMealRecipeId: string;
    mealCount: number;
    deductFromPayroll?: boolean;
  }) {
    if (!params.branchId) throw new BadRequestException("Branch is required");
    if (!Number.isInteger(params.mealCount) || params.mealCount <= 0) {
      throw new BadRequestException("mealCount must be a positive whole number");
    }

    await this.getEmployee(params.organizationId, params.employeeId);
    const recipe = await this.getStaffMealRecipe(params.branchId, params.staffMealRecipeId);
    const unitCostPerMeal = computeStaffMealUnitCost(recipe.lines);

    const staffMeal = await this.prisma.staffMeal.create({
      data: {
        employeeId: params.employeeId,
        branchId: params.branchId,
        staffMealRecipeId: params.staffMealRecipeId,
        mealCount: params.mealCount,
        unitCostPerMeal,
        deductFromPayroll: params.deductFromPayroll ?? false,
      },
      include: {
        employee: { select: { id: true, name: true } },
        recipe: { select: { id: true, name: true } },
      },
    });

    for (const line of recipe.lines) {
      const qty = toNumber(line.quantity) * params.mealCount;
      await this.inventory.createMovement({
        itemId: line.inventoryItemId,
        branchId: params.branchId,
        movementType: MovementType.STAFF_MEAL,
        quantity: qty,
        referenceType: "StaffMeal",
        referenceId: staffMeal.id,
      });
    }

    return staffMeal;
  }

  async requestPayrollRun(organizationId: string, periodStart: Date, periodEnd: Date) {
    if (periodStart >= periodEnd) {
      throw new BadRequestException("periodStart must be before periodEnd");
    }

    const run = await this.prisma.payrollRun.create({
      data: { organizationId, periodStart, periodEnd },
    });
    this.events.emit("payroll.run_requested", new PayrollRunRequestedEvent(run.id));
    return run;
  }

  /** Sum pending staff meal costs to deduct on next payroll for an employee. */
  async pendingStaffMealDeduction(employeeId: string): Promise<number> {
    const meals = await this.prisma.staffMeal.findMany({
      where: {
        employeeId,
        deductFromPayroll: true,
        payrollDeducted: false,
      },
    });
    return meals.reduce(
      (sum, m) => sum + m.mealCount * toNumber(m.unitCostPerMeal),
      0,
    );
  }
}

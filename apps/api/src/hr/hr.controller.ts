import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AttendanceType } from "@prisma/client";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { HrService } from "./hr.service";

@Controller("hr")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get("employees")
  @RequirePermission(Permission.HR_READ)
  employees(@Tenant() t: TenantContext) {
    return this.hr.listEmployees(t.organizationId);
  }

  @Post("employees")
  @RequirePermission(Permission.HR_WRITE)
  createEmployee(
    @Tenant() t: TenantContext,
    @Body() body: { name: string; designation: string; salary: number; branchId?: string },
  ) {
    return this.hr.createEmployee(t.organizationId, body);
  }

  @Get("attendance")
  @RequirePermission(Permission.HR_READ)
  attendance(@Tenant() t: TenantContext, @Query("branchId") branchId?: string) {
    return this.hr.listAttendance(branchId || t.branchId!);
  }

  @Post("attendance/clock")
  @RequirePermission(Permission.HR_WRITE)
  async clock(
    @Tenant() t: TenantContext,
    @Body() body: { employeeId: string; type: AttendanceType },
  ) {
    await this.hr.getEmployee(t.organizationId, body.employeeId);
    return this.hr.clockAttendance(body.employeeId, t.branchId!, body.type);
  }

  @Get("staff-meal-recipes")
  @RequirePermission(Permission.HR_READ)
  staffMealRecipes(@Tenant() t: TenantContext, @Query("branchId") branchId?: string) {
    return this.hr.listStaffMealRecipes(branchId || t.branchId!);
  }

  @Post("staff-meal-recipes")
  @RequirePermission(Permission.HR_WRITE)
  createStaffMealRecipe(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      name: string;
      lines: { inventoryItemId: string; quantity: number }[];
    },
  ) {
    return this.hr.upsertStaffMealRecipe(t.branchId!, body);
  }

  @Put("staff-meal-recipes/:id")
  @RequirePermission(Permission.HR_WRITE)
  updateStaffMealRecipe(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body()
    body: {
      name: string;
      lines: { inventoryItemId: string; quantity: number }[];
    },
  ) {
    return this.hr.upsertStaffMealRecipe(t.branchId!, { id, ...body });
  }

  @Get("staff-meals")
  @RequirePermission(Permission.HR_READ)
  staffMeals(@Tenant() t: TenantContext, @Query("branchId") branchId?: string) {
    return this.hr.listStaffMeals(branchId || t.branchId!);
  }

  @Post("staff-meals")
  @RequirePermission(Permission.HR_WRITE)
  staffMeal(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      employeeId: string;
      staffMealRecipeId: string;
      mealCount: number;
      deductFromPayroll?: boolean;
    },
  ) {
    return this.hr.recordStaffMeal({
      organizationId: t.organizationId,
      ...body,
      branchId: t.branchId!,
    });
  }

  @Post("payroll/runs")
  @RequirePermission(Permission.HR_WRITE)
  payrollRun(
    @Tenant() t: TenantContext,
    @Body() body: { periodStart: string; periodEnd: string },
  ) {
    return this.hr.requestPayrollRun(
      t.organizationId,
      new Date(body.periodStart),
      new Date(body.periodEnd),
    );
  }
}

import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
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

  @Post("attendance/clock")
  @RequirePermission(Permission.HR_WRITE)
  clock(
    @Tenant() t: TenantContext,
    @Body() body: { employeeId: string; type: AttendanceType },
  ) {
    return this.hr.clockAttendance(body.employeeId, t.branchId!, body.type);
  }

  @Post("staff-meals")
  @RequirePermission(Permission.HR_WRITE)
  staffMeal(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      employeeId: string;
      inventoryItemId: string;
      quantity: number;
      deductFromPayroll?: boolean;
    },
  ) {
    return this.hr.recordStaffMeal({ ...body, branchId: t.branchId! });
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

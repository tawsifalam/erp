import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";

@Controller("payroll")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class PayrollController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("runs")
  @RequirePermission(Permission.HR_READ)
  runs(@Tenant() t: TenantContext) {
    return this.prisma.payrollRun.findMany({
      where: { organizationId: t.organizationId },
      include: { lines: { include: { employee: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  @Get("runs/:id")
  @RequirePermission(Permission.HR_READ)
  run(@Param("id") id: string) {
    return this.prisma.payrollRun.findUnique({
      where: { id },
      include: { lines: { include: { employee: true } } },
    });
  }
}

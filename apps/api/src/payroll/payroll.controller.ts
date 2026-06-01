import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

@Controller("payroll")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class PayrollController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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
  run(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.prisma.payrollRun.findFirst({
      where: { id, organizationId: t.organizationId },
      include: { lines: { include: { employee: true } } },
    });
  }

  @Get("runs/:id/payslip")
  @RequirePermission(Permission.HR_READ)
  async payslip(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, organizationId: t.organizationId },
    });
    if (!run?.payslipKey) throw new NotFoundException("Payslip not available");
    const body = await this.storage.download(run.payslipKey);
    if (!body) throw new NotFoundException("Payslip file not found");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="payroll-${id}.pdf"`,
    );
    res.send(body);
  }
}

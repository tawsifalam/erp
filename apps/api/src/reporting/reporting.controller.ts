import { Controller, Get, Post, Query, UseGuards, Body } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { ReportingService } from "./reporting.service";
import { PrismaService } from "../prisma/prisma.service";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Controller("reporting")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class ReportingController {
  constructor(
    private readonly reporting: ReportingService,
    private readonly prisma: PrismaService,
    @InjectQueue("reports") private readonly reportsQueue: Queue,
  ) {}

  @Get("dashboard")
  @RequirePermission(Permission.REPORTS_READ)
  dashboard(@Tenant() t: TenantContext, @Query("branchId") branchId?: string) {
    return this.reporting.dashboard(t.organizationId, branchId || t.branchId!);
  }

  @Post("export")
  @RequirePermission(Permission.REPORTS_READ)
  async export(@Tenant() t: TenantContext, @Body() body: { type: string }) {
    const job = await this.reporting.requestExport(t.organizationId, body.type);
    await this.reportsQueue.add("export", { reportJobId: job.id });
    return job;
  }

  @Get("jobs")
  @RequirePermission(Permission.REPORTS_READ)
  jobs(@Tenant() t: TenantContext) {
    return this.prisma.reportJob.findMany({
      where: { organizationId: t.organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }
}

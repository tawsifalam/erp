import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { ReportingService } from "./reporting.service";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Controller("reporting")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class ReportingController {
  constructor(
    private readonly reporting: ReportingService,
    @InjectQueue("reports") private readonly reportsQueue: Queue,
  ) {}

  @Get("dashboard")
  @RequirePermission(Permission.REPORTS_READ)
  dashboard(@Tenant() t: TenantContext, @Query("branchId") branchId?: string) {
    return this.reporting.dashboard(t.organizationId, branchId || t.branchId!);
  }

  @Get("types")
  @RequirePermission(Permission.REPORTS_READ)
  reportTypes() {
    return this.reporting.listReportTypes();
  }

  @Post("export")
  @RequirePermission(Permission.REPORTS_READ)
  async export(
    @Tenant() t: TenantContext,
    @Body() body: { type: string; branchId?: string },
  ) {
    const branchId = body.branchId || t.branchId;
    const job = await this.reporting.requestExport(t.organizationId, body.type, branchId);
    await this.reportsQueue.add("export", { reportJobId: job.id });
    return job;
  }

  @Get("jobs")
  @RequirePermission(Permission.REPORTS_READ)
  jobs(@Tenant() t: TenantContext) {
    return this.reporting.listJobs(t.organizationId);
  }
}

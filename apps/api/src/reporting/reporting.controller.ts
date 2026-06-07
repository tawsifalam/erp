import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { TenantScopeService } from "../common/tenant/tenant-scope.service";
import { ReportingService } from "./reporting.service";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Controller("reporting")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class ReportingController {
  constructor(
    private readonly reporting: ReportingService,
    private readonly tenantScope: TenantScopeService,
    @InjectQueue("reports") private readonly reportsQueue: Queue,
  ) {}

  @Get("dashboard")
  @RequirePermission(Permission.REPORTS_READ)
  async dashboard(@Tenant() t: TenantContext, @Query("branchId") branchId?: string) {
    const resolved = await this.tenantScope.resolveBranchId(t, branchId);
    return this.reporting.dashboard(t.organizationId, resolved!);
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
    @Body()
    body: {
      type: string;
      branchId?: string;
      from?: string;
      to?: string;
      asOf?: string;
      accountCode?: string;
      format?: "csv" | "pdf";
    },
  ) {
    const branchId = await this.tenantScope.resolveBranchId(t, body.branchId, {
      required: false,
    });
    const job = await this.reporting.requestExport(
      t.organizationId,
      body.type,
      branchId,
      {
        from: body.from,
        to: body.to,
        asOf: body.asOf,
        accountCode: body.accountCode,
        format: body.format,
      },
      t.userId,
    );
    await this.reportsQueue.add("export", { reportJobId: job.id });
    return job;
  }

  @Get("jobs")
  @RequirePermission(Permission.REPORTS_READ)
  jobs(@Tenant() t: TenantContext) {
    return this.reporting.listJobs(t.organizationId);
  }

  @Get("jobs/:id/download")
  @RequirePermission(Permission.REPORTS_READ)
  async downloadJob(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const { body, contentType, filename } = await this.reporting.downloadJob(
      t.organizationId,
      id,
    );
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(body);
  }
}

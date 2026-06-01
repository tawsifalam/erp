import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { AuditService } from "./audit.service";

@Controller("audit")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get("logs")
  @RequirePermission(Permission.ADMIN)
  listLogs(
    @Tenant() t: TenantContext,
    @Query("entityType") entityType?: string,
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    return this.audit.list(t.organizationId, {
      entityType: entityType || undefined,
      userId: userId || undefined,
      from,
      to,
      limit: parsedLimit,
    });
  }
}

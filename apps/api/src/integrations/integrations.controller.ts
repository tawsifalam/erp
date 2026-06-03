import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { IntegrationsService } from "./integrations.service";

@Controller("integrations")
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get("health")
  health() {
    return this.integrations.health();
  }

  @Get("adapters")
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  listAdapters() {
    return this.integrations.listAdapters();
  }

  @Get("connections")
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  listConnections(@Tenant() t: TenantContext) {
    return this.integrations.listConnections(t.organizationId);
  }

  @Post("connections")
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  createConnection(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      adapterKey: string;
      name: string;
      branchId?: string | null;
      credentials?: Record<string, string>;
      config?: Record<string, unknown>;
    },
  ) {
    return this.integrations.createConnection(t.organizationId, t.userId, body);
  }

  @Patch("connections/:id")
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  updateConnection(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      status?: string;
      branchId?: string | null;
      credentials?: Record<string, string>;
      config?: Record<string, unknown>;
    },
  ) {
    return this.integrations.updateConnection(t.organizationId, t.userId, id, body);
  }

  @Delete("connections/:id")
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  deleteConnection(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.integrations.deleteConnection(t.organizationId, t.userId, id);
  }

  @Post("connections/:id/rotate-secret")
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  rotateSecret(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.integrations.rotateWebhookSecret(t.organizationId, t.userId, id);
  }

  @Get("connections/:id/webhook-events")
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  listWebhookEvents(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Query("limit") limit?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : 50;
    return this.integrations.listWebhookEvents(t.organizationId, id, parsed);
  }
}

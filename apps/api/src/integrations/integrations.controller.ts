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
import { ChannelManagerService } from "./channel-manager.service";

@Controller("integrations")
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly channelManager: ChannelManagerService,
  ) {}

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

  @Get("connections/:id/availability-export")
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  exportAvailability(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.channelManager.exportAvailability(t.organizationId, id, from, to);
  }

  @Get("connections/:id/availability-blocks")
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  listAvailabilityBlocks(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.channelManager.listBlocks(t.organizationId, id);
  }

  @Post("connections/:id/availability-blocks")
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  createAvailabilityBlock(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body()
    body: {
      roomId?: string | null;
      roomTypeId?: string | null;
      startDate: string;
      endDate: string;
      reason?: string;
    },
  ) {
    return this.channelManager.createBlock(t.organizationId, id, t.userId, body);
  }

  @Delete("connections/:id/availability-blocks/:blockId")
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  deleteAvailabilityBlock(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Param("blockId") blockId: string,
  ) {
    return this.channelManager.deleteBlock(t.organizationId, id, t.userId, blockId);
  }
}

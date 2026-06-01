import { Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { Tenant } from "../common/decorators/tenant.decorator";
import type { TenantContext } from "@erp/types";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard, TenantGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Tenant() t: TenantContext, @Query("limit") limit?: string) {
    const parsed = limit ? Number.parseInt(limit, 10) : 50;
    return this.notifications.listForUser(t.organizationId, t.userId, parsed);
  }

  @Get("unread-count")
  unreadCount(@Tenant() t: TenantContext) {
    return this.notifications.unreadCount(t.organizationId, t.userId);
  }

  @Patch("read-all")
  markAllRead(@Tenant() t: TenantContext) {
    return this.notifications.markAllRead(t.organizationId, t.userId);
  }

  @Patch(":id/read")
  markRead(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.notifications.markRead(t.organizationId, t.userId, id);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { PosService } from "./pos.service";

@Controller("pos")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class PosController {
  constructor(private readonly pos: PosService) {}

  private branch(t: TenantContext, branchId?: string) {
    return branchId || t.branchId!;
  }

  @Get("menu/categories")
  @RequirePermission(Permission.POS_READ)
  categories(@Tenant() t: TenantContext, @Query("branchId") branchId?: string) {
    return this.pos.listCategories(this.branch(t, branchId));
  }

  @Post("menu/categories")
  @RequirePermission(Permission.POS_WRITE)
  createCategory(
    @Tenant() t: TenantContext,
    @Body() body: { branchId?: string; name: string; sortOrder?: number },
  ) {
    return this.pos.createCategory(t.organizationId, this.branch(t, body.branchId), body);
  }

  @Post("menu/items")
  @RequirePermission(Permission.POS_WRITE)
  createItem(@Body() body: { categoryId: string; name: string; price: number }) {
    return this.pos.createMenuItem(body);
  }

  @Get("orders")
  @RequirePermission(Permission.POS_READ)
  orders(@Tenant() t: TenantContext, @Query("branchId") branchId?: string) {
    return this.pos.listOrders(this.branch(t, branchId));
  }

  @Post("orders")
  @RequirePermission(Permission.POS_WRITE)
  createOrder(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      branchId?: string;
      lines: { menuItemId: string; quantity: number; unitPrice: number }[];
      tableNumber?: string;
      notes?: string;
    },
  ) {
    return this.pos.createOrder(this.branch(t, body.branchId), t.organizationId, body);
  }

  @Post("orders/:id/submit")
  @RequirePermission(Permission.POS_WRITE)
  submit(@Param("id") id: string, @Tenant() t: TenantContext, @Query("branchId") branchId?: string) {
    return this.pos.submitOrder(id, this.branch(t, branchId), t.organizationId);
  }

  @Post("orders/:id/complete")
  @RequirePermission(Permission.POS_WRITE)
  complete(
    @Param("id") id: string,
    @Tenant() t: TenantContext,
    @Body() body: { paidAmount?: number },
    @Query("branchId") branchId?: string,
  ) {
    return this.pos.completeOrder(id, this.branch(t, branchId), t.organizationId, body.paidAmount);
  }

  @Patch("orders/:id/status")
  @RequirePermission(Permission.POS_WRITE)
  status(
    @Param("id") id: string,
    @Body() body: { status: OrderStatus },
    @Tenant() t: TenantContext,
    @Query("branchId") branchId?: string,
  ) {
    return this.pos.updateOrderStatus(id, this.branch(t, branchId), body.status);
  }
}

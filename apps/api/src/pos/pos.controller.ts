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
import { OrderStatus } from "@erp/types";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { TenantScopeService } from "../common/tenant/tenant-scope.service";
import { PosService } from "./pos.service";

@Controller("pos")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class PosController {
  constructor(
    private readonly pos: PosService,
    private readonly tenantScope: TenantScopeService,
  ) {}

  private resolveBranch(t: TenantContext, override?: string) {
    return this.tenantScope.resolveBranchId(t, override);
  }

  @Get("menu/categories")
  @RequirePermission(Permission.POS_READ)
  async categories(@Tenant() t: TenantContext, @Query("branchId") branchId?: string) {
    return this.pos.listCategories((await this.resolveBranch(t, branchId))!);
  }

  @Post("menu/categories")
  @RequirePermission(Permission.POS_WRITE)
  async createCategory(
    @Tenant() t: TenantContext,
    @Body() body: { branchId?: string; name: string; sortOrder?: number },
  ) {
    const resolved = await this.resolveBranch(t, body.branchId);
    return this.pos.createCategory(t.organizationId, resolved!, body);
  }

  @Patch("menu/categories/:id")
  @RequirePermission(Permission.POS_WRITE)
  async updateCategory(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Query("branchId") branchId: string | undefined,
    @Body() body: { name?: string; sortOrder?: number },
  ) {
    return this.pos.updateCategory((await this.resolveBranch(t, branchId))!, id, body);
  }

  @Delete("menu/categories/:id")
  @RequirePermission(Permission.POS_WRITE)
  async deleteCategory(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Query("branchId") branchId: string | undefined,
  ) {
    return this.pos.deleteCategory((await this.resolveBranch(t, branchId))!, id);
  }

  @Post("menu/items")
  @RequirePermission(Permission.POS_WRITE)
  async createItem(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      categoryId: string;
      name: string;
      price: number;
      isActive?: boolean;
      isGuestInclusionMeal?: boolean;
    },
  ) {
    const branchId = (await this.resolveBranch(t))!;
    return this.pos.createMenuItem(t.organizationId, branchId, body);
  }

  @Patch("menu/items/:id")
  @RequirePermission(Permission.POS_WRITE)
  async updateItem(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      price?: number;
      isActive?: boolean;
      categoryId?: string;
      isGuestInclusionMeal?: boolean;
    },
  ) {
    const branchId = (await this.resolveBranch(t))!;
    return this.pos.updateMenuItem(t.organizationId, branchId, id, body);
  }

  @Delete("menu/items/:id")
  @RequirePermission(Permission.POS_WRITE)
  async deleteItem(@Tenant() t: TenantContext, @Param("id") id: string) {
    const branchId = (await this.resolveBranch(t))!;
    return this.pos.deleteMenuItem(t.organizationId, branchId, id);
  }

  @Get("orders")
  @RequirePermission(Permission.POS_READ)
  async orders(@Tenant() t: TenantContext, @Query("branchId") branchId?: string) {
    return this.pos.listOrders((await this.resolveBranch(t, branchId))!);
  }

  @Get("orders/:id")
  @RequirePermission(Permission.POS_READ)
  async getOrder(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.pos.getOrder((await this.resolveBranch(t, branchId))!, id);
  }

  @Post("orders")
  @RequirePermission(Permission.POS_WRITE)
  async createOrder(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      branchId?: string;
      lines: { menuItemId: string; quantity: number; unitPrice: number }[];
      tableNumber?: string;
      notes?: string;
      reservationId?: string;
    },
  ) {
    const resolved = await this.resolveBranch(t, body.branchId);
    return this.pos.createOrder(resolved!, t.organizationId, body);
  }

  @Post("orders/:id/submit")
  @RequirePermission(Permission.POS_WRITE)
  async submit(
    @Param("id") id: string,
    @Tenant() t: TenantContext,
    @Query("branchId") branchId?: string,
  ) {
    return this.pos.submitOrder(id, (await this.resolveBranch(t, branchId))!, t.organizationId);
  }

  @Post("orders/:id/complete")
  @RequirePermission(Permission.POS_WRITE)
  async complete(
    @Param("id") id: string,
    @Tenant() t: TenantContext,
    @Body() body: { paidAmount?: number },
    @Query("branchId") branchId?: string,
  ) {
    return this.pos.completeOrder(
      id,
      (await this.resolveBranch(t, branchId))!,
      t.organizationId,
      body.paidAmount,
      t.userId,
    );
  }

  @Post("orders/:id/cancel")
  @RequirePermission(Permission.POS_WRITE)
  async cancel(
    @Param("id") id: string,
    @Tenant() t: TenantContext,
    @Query("branchId") branchId?: string,
  ) {
    return this.pos.cancelOrder(
      id,
      (await this.resolveBranch(t, branchId))!,
      t.organizationId,
      t.userId,
    );
  }

  @Patch("orders/:id/status")
  @RequirePermission(Permission.POS_WRITE)
  async status(
    @Param("id") id: string,
    @Body() body: { status: OrderStatus },
    @Tenant() t: TenantContext,
    @Query("branchId") branchId?: string,
  ) {
    return this.pos.updateOrderStatus(id, (await this.resolveBranch(t, branchId))!, body.status);
  }

  @Delete("orders/:id")
  @RequirePermission(Permission.POS_WRITE)
  async deleteOrder(
    @Param("id") id: string,
    @Tenant() t: TenantContext,
    @Query("branchId") branchId?: string,
  ) {
    return this.pos.deleteOrder(id, (await this.resolveBranch(t, branchId))!);
  }
}

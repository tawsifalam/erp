import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { MovementDirection, MovementType } from "@prisma/client";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { InventoryService } from "./inventory.service";
import { InventoryRecipesService } from "./inventory-recipes.service";

@Controller("inventory")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly recipes: InventoryRecipesService,
  ) {}

  @Get("items")
  @RequirePermission(Permission.INVENTORY_READ)
  items(@Tenant() t: TenantContext, @Query("branchId") branchId?: string) {
    return this.inventory.listItemsWithStock(branchId || t.branchId!);
  }

  @Post("items")
  @RequirePermission(Permission.INVENTORY_WRITE)
  createItem(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      branchId?: string;
      name: string;
      sku: string;
      unit: string;
      lowStockThreshold?: number;
    },
  ) {
    return this.inventory.createItem(body.branchId || t.branchId!, body);
  }

  @Patch("items/:id")
  @RequirePermission(Permission.INVENTORY_WRITE)
  updateItem(
    @Param("id") id: string,
    @Tenant() t: TenantContext,
    @Query("branchId") branchId: string | undefined,
    @Body()
    body: { name?: string; unit?: string; lowStockThreshold?: number | null },
  ) {
    return this.inventory.updateItem(branchId || t.branchId!, id, body);
  }

  @Get("items/:id/stock")
  @RequirePermission(Permission.INVENTORY_READ)
  stock(
    @Param("id") id: string,
    @Tenant() t: TenantContext,
    @Query("branchId") branchId?: string,
  ) {
    return this.inventory.getCurrentStock(id, branchId || t.branchId!);
  }

  @Post("movements")
  @RequirePermission(Permission.INVENTORY_WRITE)
  movement(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      itemId: string;
      branchId?: string;
      movementType: MovementType;
      quantity: number;
      direction?: MovementDirection;
      referenceType?: string;
      referenceId?: string;
      notes?: string;
    },
  ) {
    return this.inventory.createMovement({
      ...body,
      branchId: body.branchId || t.branchId!,
    });
  }

  @Get("items/:id/movements")
  @RequirePermission(Permission.INVENTORY_READ)
  movements(
    @Param("id") id: string,
    @Tenant() t: TenantContext,
    @Query("branchId") branchId?: string,
  ) {
    return this.inventory.listMovements(id, branchId || t.branchId!);
  }

  @Post("recipes")
  @RequirePermission(Permission.INVENTORY_WRITE)
  recipe(@Body() body: { menuItemId: string; lines: { inventoryItemId: string; quantity: number }[] }) {
    return this.recipes.upsertRecipe(body.menuItemId, body.lines);
  }

  @Get("recipes/:menuItemId")
  @RequirePermission(Permission.INVENTORY_READ)
  getRecipe(@Param("menuItemId") menuItemId: string) {
    return this.recipes.getRecipe(menuItemId);
  }
}

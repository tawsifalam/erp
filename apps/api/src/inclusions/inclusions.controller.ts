import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { InclusionType, Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { InclusionsService } from "./inclusions.service";

@Controller("inclusions")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class InclusionsController {
  constructor(private readonly inclusions: InclusionsService) {}

  private branchId(t: TenantContext, query?: string) {
    return query || t.branchId!;
  }

  @Get("packages")
  @RequirePermission(Permission.PMS_READ)
  listPackages(@Tenant() t: TenantContext) {
    return this.inclusions.listPackages(t.organizationId);
  }

  @Post("packages")
  @RequirePermission(Permission.PMS_WRITE)
  createPackage(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      name: string;
      isDefault?: boolean;
      isActive?: boolean;
      rules?: {
        inclusionType: InclusionType;
        inclusionRecipeId: string;
        quantityPerGuestPerNight?: number | null;
        quantityPerGuestPerStay?: number | null;
        autoIssueOnCheckIn?: boolean;
        sortOrder?: number;
      }[];
    },
  ) {
    return this.inclusions.createPackage(t.organizationId, body);
  }

  @Patch("packages/:id")
  @RequirePermission(Permission.PMS_WRITE)
  updatePackage(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      isDefault?: boolean;
      isActive?: boolean;
      rules?: {
        inclusionType: InclusionType;
        inclusionRecipeId: string;
        quantityPerGuestPerNight?: number | null;
        quantityPerGuestPerStay?: number | null;
        autoIssueOnCheckIn?: boolean;
        sortOrder?: number;
      }[];
    },
  ) {
    return this.inclusions.updatePackage(t.organizationId, id, body);
  }

  @Get("recipes")
  @RequirePermission(Permission.PMS_READ)
  listRecipes(@Tenant() t: TenantContext, @Query("branchId") branchId: string) {
    return this.inclusions.listRecipes(this.branchId(t, branchId));
  }

  @Post("recipes")
  @RequirePermission(Permission.PMS_WRITE)
  createRecipe(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      branchId?: string;
      name: string;
      inclusionType: InclusionType;
      lines: { inventoryItemId: string; quantity: number }[];
    },
  ) {
    return this.inclusions.upsertRecipe(body.branchId || t.branchId!, body);
  }

  @Put("recipes/:id")
  @RequirePermission(Permission.PMS_WRITE)
  updateRecipe(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body()
    body: {
      branchId?: string;
      name: string;
      inclusionType: InclusionType;
      lines: { inventoryItemId: string; quantity: number }[];
    },
  ) {
    return this.inclusions.upsertRecipe(body.branchId || t.branchId!, { ...body, id });
  }

  @Get("reservations/:id/allowances")
  @RequirePermission(Permission.PMS_READ)
  listAllowances(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Query("branchId") branchId: string,
  ) {
    return this.inclusions.listAllowances(this.branchId(t, branchId), id);
  }

  @Post("reservations/:id/consume")
  @RequirePermission(Permission.PMS_WRITE)
  consume(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Query("branchId") branchId: string,
    @Body()
    body: {
      inclusionType: InclusionType;
      inclusionRecipeId: string;
      quantity: number;
    },
  ) {
    return this.inclusions.consumeManual(this.branchId(t, branchId), id, body);
  }

  @Post("reservations/:id/reconcile")
  @RequirePermission(Permission.PMS_WRITE)
  reconcile(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Query("branchId") branchId: string,
  ) {
    return this.inclusions.reconcileAllowances(this.branchId(t, branchId), id);
  }
}

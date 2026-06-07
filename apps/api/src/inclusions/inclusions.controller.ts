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
import { TenantScopeService } from "../common/tenant/tenant-scope.service";
import { InclusionsService } from "./inclusions.service";

@Controller("inclusions")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class InclusionsController {
  constructor(
    private readonly inclusions: InclusionsService,
    private readonly tenantScope: TenantScopeService,
  ) {}

  private resolveBranch(t: TenantContext, override?: string) {
    return this.tenantScope.resolveBranchId(t, override);
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
  async listRecipes(@Tenant() t: TenantContext, @Query("branchId") branchId: string) {
    return this.inclusions.listRecipes((await this.resolveBranch(t, branchId))!);
  }

  @Post("recipes")
  @RequirePermission(Permission.PMS_WRITE)
  async createRecipe(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      branchId?: string;
      name: string;
      inclusionType: InclusionType;
      lines: { inventoryItemId: string; quantity: number }[];
    },
  ) {
    const resolved = await this.resolveBranch(t, body.branchId);
    return this.inclusions.upsertRecipe(resolved!, body);
  }

  @Put("recipes/:id")
  @RequirePermission(Permission.PMS_WRITE)
  async updateRecipe(
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
    const resolved = await this.resolveBranch(t, body.branchId);
    return this.inclusions.upsertRecipe(resolved!, { ...body, id });
  }

  @Get("reservations/:id/allowances")
  @RequirePermission(Permission.PMS_READ)
  async listAllowances(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Query("branchId") branchId: string,
  ) {
    return this.inclusions.listAllowances((await this.resolveBranch(t, branchId))!, id);
  }

  @Post("reservations/:id/consume")
  @RequirePermission(Permission.PMS_WRITE)
  async consume(
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
    return this.inclusions.consumeManual((await this.resolveBranch(t, branchId))!, id, body);
  }

  @Post("reservations/:id/reconcile")
  @RequirePermission(Permission.PMS_WRITE)
  async reconcile(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Query("branchId") branchId: string,
  ) {
    return this.inclusions.reconcileAllowances((await this.resolveBranch(t, branchId))!, id);
  }
}

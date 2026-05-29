import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permission } from "@erp/types";
import type { AuthUserPayload, TenantContext } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { TenantsService } from "./tenants.service";

@Controller("tenants")
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly prisma: PrismaService,
  ) {}

  private async requireUser(claims: AuthUserPayload) {
    const user = await this.prisma.user.findUnique({
      where: { propelAuthUserId: claims.userId },
    });
    if (!user) return null;
    return user;
  }

  @Get("organizations")
  async organizations(@CurrentUser() claims: AuthUserPayload) {
    const user = await this.requireUser(claims);
    if (!user) return [];
    return this.tenants.listOrganizations(user.id);
  }

  @Post("organizations")
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  async createOrganization(
    @CurrentUser() claims: AuthUserPayload,
    @Body() body: { name: string; timezone: string; propelAuthOrgId?: string },
  ) {
    const user = await this.requireUser(claims);
    if (!user) return null;
    return this.tenants.createOrganization(user.id, body);
  }

  @Get("organizations/current")
  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  currentOrganization(@Tenant() t: TenantContext) {
    return this.tenants.getOrganization(t.organizationId);
  }

  @Patch("organizations/current")
  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  updateCurrentOrganization(
    @Tenant() t: TenantContext,
    @Body() body: { name: string },
  ) {
    return this.tenants.updateOrganization(t.organizationId, { name: body.name });
  }

  @Get("branches")
  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  listBranches(@Tenant() t: TenantContext) {
    return this.tenants.listBranches(t.organizationId);
  }

  @Post("branches")
  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  createBranch(
    @Tenant() t: TenantContext,
    @Body() body: { name: string; timezone: string },
  ) {
    return this.tenants.createBranch(t.organizationId, body);
  }

  @Patch("branches/:id")
  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  updateBranch(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body() body: { name?: string; timezone?: string },
  ) {
    return this.tenants.updateBranch(id, t.organizationId, body);
  }

  @Get("context")
  @UseGuards(TenantGuard)
  context(@Req() req: Request & { tenant: unknown }) {
    return req.tenant;
  }
}

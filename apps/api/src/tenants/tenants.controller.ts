import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { Permission, Role } from "@erp/types";
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

  @Get("onboarding/status")
  async onboardingStatus(@CurrentUser() claims: AuthUserPayload) {
    const user = await this.requireUser(claims);
    if (!user) {
      return { hasMembership: false, canAccessApp: false, pendingRequest: null };
    }
    return this.tenants.getOnboardingStatus(user.id);
  }

  @Get("organizations/search")
  async searchOrganizations(@Query("q") q: string) {
    return this.tenants.searchOrganizations(q ?? "");
  }

  @Get("organizations/by-join-code/:code")
  async organizationByJoinCode(@Param("code") code: string) {
    const org = await this.tenants.getOrganizationByJoinCode(code);
    if (!org) return null;
    return org;
  }

  @Get("organizations")
  async organizations(@CurrentUser() claims: AuthUserPayload) {
    const user = await this.requireUser(claims);
    if (!user) return [];
    return this.tenants.listOrganizations(user.id);
  }

  @Post("organizations")
  async createOrganization(
    @CurrentUser() claims: AuthUserPayload,
    @Body() body: { name: string; timezone: string; propelAuthOrgId?: string },
  ) {
    const user = await this.requireUser(claims);
    if (!user) return null;

    const membershipCount = await this.tenants.countMemberships(user.id);
    if (membershipCount > 0) {
      // Additional org creation requires admin permission — handled by guard on a separate path
      // For users with existing membership, enforce ADMIN via manual check
      const hasAdminMembership = await this.prisma.userOrganization.findFirst({
        where: { userId: user.id, role: { in: [Role.OWNER, Role.ADMIN] } },
      });
      if (!hasAdminMembership) {
        throw new ForbiddenException("Admin permission required to create additional organizations");
      }
    }

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

  @Post("join-requests")
  async createJoinRequest(
    @CurrentUser() claims: AuthUserPayload,
    @Body() body: { organizationId?: string; joinCode?: string; message?: string },
  ) {
    const user = await this.requireUser(claims);
    if (!user) return null;
    return this.tenants.createJoinRequest(user.id, body);
  }

  @Delete("join-requests/:id")
  async cancelJoinRequest(
    @CurrentUser() claims: AuthUserPayload,
    @Param("id") id: string,
  ) {
    const user = await this.requireUser(claims);
    if (!user) return null;
    return this.tenants.cancelJoinRequest(user.id, id);
  }

  @Get("join-requests/mine")
  async myJoinRequests(@CurrentUser() claims: AuthUserPayload) {
    const user = await this.requireUser(claims);
    if (!user) return [];
    return this.tenants.listMyJoinRequests(user.id);
  }

  @Get("join-requests")
  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  listJoinRequests(@Tenant() t: TenantContext) {
    return this.tenants.listPendingJoinRequests(t.organizationId);
  }

  @Post("join-requests/:id/approve")
  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  async approveJoinRequest(
    @CurrentUser() claims: AuthUserPayload,
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body() body: { role: string },
  ) {
    if (!body.role) {
      throw new BadRequestException("Role is required when approving a join request");
    }
    const user = await this.requireUser(claims);
    if (!user) return null;
    return this.tenants.approveJoinRequest(user.id, t.organizationId, id, body.role);
  }

  @Post("join-requests/:id/reject")
  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  async rejectJoinRequest(
    @CurrentUser() claims: AuthUserPayload,
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body() body: { reason?: string },
  ) {
    const user = await this.requireUser(claims);
    if (!user) return null;
    return this.tenants.rejectJoinRequest(user.id, t.organizationId, id, body.reason);
  }

  @Get("members")
  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  async listMembers(@Tenant() t: TenantContext) {
    return this.tenants.listMembers(t.organizationId);
  }

  @Delete("members/:userId")
  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  async removeMember(
    @CurrentUser() claims: AuthUserPayload,
    @Tenant() t: TenantContext,
    @Param("userId") userId: string,
  ) {
    const user = await this.requireUser(claims);
    if (!user) return null;
    return this.tenants.removeMember(t.organizationId, userId, user.id);
  }

  @Patch("members/:userId/role")
  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(Permission.ADMIN)
  async updateMemberRole(
    @CurrentUser() claims: AuthUserPayload,
    @Tenant() t: TenantContext,
    @Param("userId") userId: string,
    @Body() body: { role: string },
  ) {
    const user = await this.requireUser(claims);
    if (!user) return null;
    return this.tenants.updateMemberRole(t.organizationId, userId, body.role, user.id);
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

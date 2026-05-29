import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("members")
  @RequirePermission(Permission.ADMIN)
  listMembers(@Tenant() tenant: TenantContext) {
    return this.users.listMembers(tenant.organizationId);
  }
}

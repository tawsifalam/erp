import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { Tenant } from "../common/decorators/tenant.decorator";
import { roleHasPermission } from "@erp/utils";
import { Permission, Role } from "@erp/types";
import type { TenantContext } from "@erp/types";

@Controller("permissions")
@UseGuards(JwtAuthGuard, TenantGuard)
export class PermissionsController {
  @Get("me")
  myPermissions(@Tenant() tenant: TenantContext) {
    const role = tenant.role as Role;
    return {
      role,
      permissions: Object.values(Permission).filter((p) =>
        roleHasPermission(role, p),
      ),
    };
  }
}

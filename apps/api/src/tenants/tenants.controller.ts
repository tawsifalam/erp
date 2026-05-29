import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUserPayload } from "@erp/types";
import { TenantsService } from "./tenants.service";

@Controller("tenants")
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("organizations")
  async organizations(@CurrentUser() claims: AuthUserPayload) {
    const user = await this.prisma.user.findUnique({
      where: { propelAuthUserId: claims.userId },
    });
    if (!user) return [];
    return this.tenants.listOrganizations(user.id);
  }

  @Get("context")
  @UseGuards(TenantGuard)
  context(@Req() req: Request & { tenant: unknown }) {
    return req.tenant;
  }
}

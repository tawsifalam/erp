import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.userId) return false;

    const orgHeader = request.headers["x-organization-id"] as string | undefined;
    if (!orgHeader) {
      throw new BadRequestException("X-Organization-Id header is required");
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { propelAuthUserId: user.userId },
      include: {
        memberships: { where: { organizationId: orgHeader } },
      },
    });

    if (!dbUser || dbUser.memberships.length === 0) {
      throw new ForbiddenException("Not a member of this organization");
    }

    const membership = dbUser.memberships[0];
    const branchHeader = request.headers["x-branch-id"] as string | undefined;

    request.tenant = {
      organizationId: orgHeader,
      branchId: branchHeader,
      userId: dbUser.id,
      role: membership.role,
    };

    return true;
  }
}

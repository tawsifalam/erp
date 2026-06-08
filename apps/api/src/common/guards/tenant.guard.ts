import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  hasImplicitBranchAccess,
  UserBranchStatus,
} from "../../tenants/branch-access.constants";

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
      where: { id: user.userId },
      include: {
        memberships: { where: { organizationId: orgHeader } },
      },
    });

    if (!dbUser || dbUser.memberships.length === 0) {
      throw new ForbiddenException("Not a member of this organization");
    }

    const membership = dbUser.memberships[0];
    const branchHeader = request.headers["x-branch-id"] as string | undefined;

    if (branchHeader) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchHeader, organizationId: orgHeader },
      });
      if (!branch) {
        throw new ForbiddenException("Branch does not belong to this organization");
      }

      if (!hasImplicitBranchAccess(membership.role)) {
        const grant = await this.prisma.userBranch.findUnique({
          where: { userId_branchId: { userId: dbUser.id, branchId: branchHeader } },
        });
        if (
          !grant ||
          grant.organizationId !== orgHeader ||
          grant.status !== UserBranchStatus.ACTIVE
        ) {
          throw new ForbiddenException("You do not have access to this branch");
        }
      }
    }

    request.tenant = {
      organizationId: orgHeader,
      branchId: branchHeader,
      userId: dbUser.id,
      role: membership.role,
    };

    return true;
  }
}

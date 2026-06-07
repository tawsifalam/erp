import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { TenantContext } from "@erp/types";
import { PrismaService } from "../../prisma/prisma.service";
import {
  hasImplicitBranchAccess,
  UserBranchStatus,
} from "../../tenants/branch-access.constants";

@Injectable()
export class TenantScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve and validate a branch id for tenant-scoped routes.
   * Prefers override (query/body) over X-Branch-Id header.
   */
  async resolveBranchId(
    tenant: TenantContext,
    override?: string | null,
    options?: { required?: boolean },
  ): Promise<string | undefined> {
    const required = options?.required ?? true;
    const branchId = override ?? tenant.branchId ?? undefined;

    if (!branchId) {
      if (required) {
        throw new BadRequestException("branchId is required");
      }
      return undefined;
    }

    await this.assertBranchAccess(tenant, branchId);
    return branchId;
  }

  async assertBranchInOrganization(
    organizationId: string,
    branchId: string,
  ): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
    if (!branch) {
      throw new ForbiddenException("Branch does not belong to this organization");
    }
  }

  private async assertBranchAccess(
    tenant: TenantContext,
    branchId: string,
  ): Promise<void> {
    await this.assertBranchInOrganization(tenant.organizationId, branchId);

    if (!hasImplicitBranchAccess(tenant.role)) {
      const grant = await this.prisma.userBranch.findUnique({
        where: { userId_branchId: { userId: tenant.userId, branchId } },
      });
      if (
        !grant ||
        grant.organizationId !== tenant.organizationId ||
        grant.status !== UserBranchStatus.ACTIVE
      ) {
        throw new ForbiddenException("You do not have access to this branch");
      }
    }
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { generatePrefixedId } from "@erp/utils";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryPoolsService } from "../inventory/inventory-pools.service";

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryPools: InventoryPoolsService,
  ) {}

  listOrganizations(userId: string) {
    return this.prisma.userOrganization.findMany({
      where: { userId },
      include: { organization: { include: { branches: { orderBy: { name: "asc" } } } } },
      orderBy: { organization: { name: "asc" } },
    });
  }

  getOrganization(organizationId: string) {
    return this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { branches: { orderBy: { name: "asc" } } },
    });
  }

  updateOrganization(organizationId: string, data: { name?: string }) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data,
      include: { branches: { orderBy: { name: "asc" } } },
    });
  }

  async createOrganization(
    userId: string,
    data: { name: string; timezone: string; propelAuthOrgId?: string },
  ) {
    const propelAuthOrgId = data.propelAuthOrgId ?? `erp_${generatePrefixedId("org")}`;

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          propelAuthOrgId,
          name: data.name,
        },
      });

      const branch = await tx.branch.create({
        data: {
          organizationId: org.id,
          name: "Main Branch",
          timezone: data.timezone,
        },
      });

      await tx.userOrganization.create({
        data: {
          userId,
          organizationId: org.id,
          role: Role.OWNER,
        },
      });

      return { organization: { ...org, branches: [branch] }, branch };
    }).then(async (result) => {
      await this.inventoryPools.seedDefaultPools(result.organization.id);
      return result;
    });
  }

  listBranches(organizationId: string) {
    return this.prisma.branch.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  createBranch(organizationId: string, data: { name: string; timezone: string }) {
    return this.prisma.branch.create({
      data: { organizationId, ...data },
    });
  }

  async updateBranch(
    branchId: string,
    organizationId: string,
    data: { name?: string; timezone?: string },
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    return this.prisma.branch.update({
      where: { id: branchId },
      data,
    });
  }

  getBranch(branchId: string, organizationId: string) {
    return this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
  }
}

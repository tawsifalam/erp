import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@erp/types";
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
    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException("Organization name is required");
    }

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: data.name !== undefined ? { name: data.name.trim() } : data,
      include: { branches: { orderBy: { name: "asc" } } },
    });
  }

  async createOrganization(
    userId: string,
    data: { name: string; timezone: string; propelAuthOrgId?: string },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("Organization name is required");
    if (!data.timezone?.trim()) throw new BadRequestException("Timezone is required");

    const propelAuthOrgId = data.propelAuthOrgId ?? `erp_${generatePrefixedId("org")}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          propelAuthOrgId,
          name: data.name.trim(),
        },
      });

      const branch = await tx.branch.create({
        data: {
          organizationId: org.id,
          name: "Main Branch",
          timezone: data.timezone.trim(),
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
    });

    await this.inventoryPools.seedDefaultPools(result.organization.id);
    return result;
  }

  listBranches(organizationId: string) {
    return this.prisma.branch.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  createBranch(organizationId: string, data: { name: string; timezone: string }) {
    if (!data.name?.trim()) throw new BadRequestException("Branch name is required");
    if (!data.timezone?.trim()) throw new BadRequestException("Timezone is required");

    return this.prisma.branch.create({
      data: {
        organizationId,
        name: data.name.trim(),
        timezone: data.timezone.trim(),
      },
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

    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException("Branch name is required");
    }
    if (data.timezone !== undefined && !data.timezone.trim()) {
      throw new BadRequestException("Timezone is required");
    }

    return this.prisma.branch.update({
      where: { id: branchId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone.trim() } : {}),
      },
    });
  }

  getBranch(branchId: string, organizationId: string) {
    return this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
  }
}

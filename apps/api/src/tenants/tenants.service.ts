import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  listOrganizations(userId: string) {
    return this.prisma.userOrganization.findMany({
      where: { userId },
      include: { organization: { include: { branches: true } } },
    });
  }

  getBranch(branchId: string, organizationId: string) {
    return this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
  }
}

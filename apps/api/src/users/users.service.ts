import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  listMembers(organizationId: string) {
    return this.prisma.userOrganization.findMany({
      where: { organizationId },
      include: { user: true },
    });
  }
}

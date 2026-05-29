import { Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
import type { AuthUserPayload } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async syncUser(claims: AuthUserPayload, propelAuthOrgId?: string) {
    const name =
      [claims.firstName, claims.lastName].filter(Boolean).join(" ") || undefined;
    const email = claims.email ?? `${claims.userId}@unknown.local`;

    const user = await this.prisma.user.upsert({
      where: { propelAuthUserId: claims.userId },
      update: { email, name },
      create: {
        propelAuthUserId: claims.userId,
        email,
        name,
      },
    });

    const orgExternalId = propelAuthOrgId ?? claims.orgId;
    if (orgExternalId) {
      const org = await this.prisma.organization.upsert({
        where: { propelAuthOrgId: orgExternalId },
        update: {},
        create: {
          propelAuthOrgId: orgExternalId,
          name: "Organization",
        },
      });

      await this.prisma.userOrganization.upsert({
        where: {
          userId_organizationId: { userId: user.id, organizationId: org.id },
        },
        update: {},
        create: {
          userId: user.id,
          organizationId: org.id,
          role: Role.ADMIN,
        },
      });
    }

    return this.prisma.user.findUnique({
      where: { id: user.id },
      include: { memberships: { include: { organization: true } } },
    });
  }
}

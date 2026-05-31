import { Injectable } from "@nestjs/common";
import { JoinRequestStatus } from "@erp/types";
import type { AuthUserPayload } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async syncUser(claims: AuthUserPayload) {
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

    const membershipCount = await this.prisma.userOrganization.count({
      where: { userId: user.id },
    });

    const pendingJoinRequest = await this.prisma.organizationJoinRequest.findFirst({
      where: { userId: user.id, status: JoinRequestStatus.PENDING },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { memberships: { include: { organization: true } } },
    });

    return {
      user: fullUser,
      hasActiveMembership: membershipCount > 0,
      pendingJoinRequest: pendingJoinRequest
        ? {
            id: pendingJoinRequest.id,
            organizationId: pendingJoinRequest.organizationId,
            organizationName: pendingJoinRequest.organization.name,
            message: pendingJoinRequest.message,
            createdAt: pendingJoinRequest.createdAt,
          }
        : null,
    };
  }
}

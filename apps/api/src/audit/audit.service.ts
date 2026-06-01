import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { generatePrefixedId } from "@erp/utils";
import { PrismaService } from "../prisma/prisma.service";

export type AuditRecordInput = {
  organizationId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditListQuery = {
  entityType?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Persist an audit row; failures are logged and do not throw. */
  async record(input: AuditRecordInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          id: generatePrefixedId("aud"),
          organizationId: input.organizationId,
          userId: input.userId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to write audit log ${input.action} ${input.entityType}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  list(organizationId: string, query: AuditListQuery = {}) {
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) {
      const from = new Date(query.from);
      if (!Number.isNaN(from.getTime())) createdAt.gte = from;
    }
    if (query.to) {
      const to = new Date(query.to);
      if (!Number.isNaN(to.getTime())) createdAt.lte = to;
    }

    return this.prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.userId ? { userId: query.userId } : {}),
        ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}

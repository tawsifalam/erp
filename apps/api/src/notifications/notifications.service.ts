import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Role } from "@erp/types";
import { generatePrefixedId } from "@erp/utils";
import { PrismaService } from "../prisma/prisma.service";
import type { NotificationTypeValue } from "./notifications.constants";

export type NotifyUserInput = {
  organizationId: string;
  userId: string;
  type: NotificationTypeValue;
  title: string;
  body: string;
  link?: string;
  email?: boolean;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue("notifications") private readonly queue: Queue,
  ) {}

  async notifyUser(input: NotifyUserInput) {
    const row = await this.prisma.notification.create({
      data: {
        id: generatePrefixedId("ntf"),
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
      },
    });

    if (input.email !== false) {
      await this.queue.add("email", {
        userId: input.userId,
        title: input.title,
        body: input.body,
      });
    }

    return row;
  }

  async notifyOrganizationRoles(
    organizationId: string,
    roles: Role[],
    input: Omit<NotifyUserInput, "organizationId" | "userId">,
  ) {
    const members = await this.prisma.userOrganization.findMany({
      where: { organizationId, role: { in: roles } },
      select: { userId: true },
    });
    const userIds = [...new Set(members.map((m) => m.userId))];
    for (const userId of userIds) {
      await this.notifyUser({ organizationId, userId, ...input });
    }
  }

  listForUser(organizationId: string, userId: string, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 100);
    return this.prisma.notification.findMany({
      where: { organizationId, userId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  async unreadCount(organizationId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: { organizationId, userId, readAt: null },
    });
    return { count };
  }

  async markRead(organizationId: string, userId: string, id: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id, organizationId, userId },
    });
    if (!existing) throw new NotFoundException("Notification not found");
    if (existing.readAt) return existing;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(organizationId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { organizationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}

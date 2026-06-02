import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Role } from "@erp/types";
import { generatePrefixedId } from "@erp/utils";
import { PrismaService } from "../prisma/prisma.service";
import {
  DEFAULT_NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPE_DESCRIPTIONS,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  NotificationChannelPreference,
  NotificationTypeValue,
  isNotificationType,
} from "./notifications.constants";

export type NotifyUserInput = {
  organizationId: string;
  userId: string;
  type: NotificationTypeValue;
  title: string;
  body: string;
  link?: string;
};

export type NotificationPreferenceView = {
  type: NotificationTypeValue;
  label: string;
  description: string;
  inApp: boolean;
  email: boolean;
  isDefault: boolean;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue("notifications") private readonly queue: Queue,
  ) {}

  async notifyUser(input: NotifyUserInput) {
    const channels = await this.resolveChannels(
      input.organizationId,
      input.userId,
      input.type,
    );

    if (!channels.inApp && !channels.email) {
      return null;
    }

    let row = null;
    if (channels.inApp) {
      row = await this.prisma.notification.create({
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
    }

    if (channels.email) {
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

  async listPreferences(
    organizationId: string,
    userId: string,
  ): Promise<NotificationPreferenceView[]> {
    const saved = await this.prisma.notificationPreference.findMany({
      where: { organizationId, userId },
    });
    const byType = new Map(saved.map((row) => [row.type, row]));

    return NOTIFICATION_TYPES.map((type) => {
      const row = byType.get(type);
      const defaults = DEFAULT_NOTIFICATION_CHANNELS[type];
      return {
        type,
        label: NOTIFICATION_TYPE_LABELS[type],
        description: NOTIFICATION_TYPE_DESCRIPTIONS[type],
        inApp: row?.inApp ?? defaults.inApp,
        email: row?.email ?? defaults.email,
        isDefault: !row,
      };
    });
  }

  async updatePreference(
    organizationId: string,
    userId: string,
    type: string,
    patch: Partial<NotificationChannelPreference>,
  ): Promise<NotificationPreferenceView> {
    if (!isNotificationType(type)) {
      throw new BadRequestException(`Invalid notification type: ${type}`);
    }

    const defaults = DEFAULT_NOTIFICATION_CHANNELS[type];
    const existing = await this.prisma.notificationPreference.findUnique({
      where: {
        organizationId_userId_type: { organizationId, userId, type },
      },
    });

    const inApp = patch.inApp ?? existing?.inApp ?? defaults.inApp;
    const email = patch.email ?? existing?.email ?? defaults.email;

    const row = await this.prisma.notificationPreference.upsert({
      where: {
        organizationId_userId_type: { organizationId, userId, type },
      },
      create: {
        organizationId,
        userId,
        type,
        inApp,
        email,
      },
      update: {
        inApp,
        email,
      },
    });

    return {
      type,
      label: NOTIFICATION_TYPE_LABELS[type],
      description: NOTIFICATION_TYPE_DESCRIPTIONS[type],
      inApp: row.inApp,
      email: row.email,
      isDefault: false,
    };
  }

  async resolveChannels(
    organizationId: string,
    userId: string,
    type: NotificationTypeValue,
  ): Promise<NotificationChannelPreference> {
    const row = await this.prisma.notificationPreference.findUnique({
      where: {
        organizationId_userId_type: { organizationId, userId, type },
      },
    });
    const defaults = DEFAULT_NOTIFICATION_CHANNELS[type];
    return {
      inApp: row?.inApp ?? defaults.inApp,
      email: row?.email ?? defaults.email,
    };
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

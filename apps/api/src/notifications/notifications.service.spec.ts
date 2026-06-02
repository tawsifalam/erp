import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { NotificationsService } from "./notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationType } from "./notifications.constants";

const mockPrisma = {
  notification: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  notificationPreference: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
  userOrganization: { findMany: jest.fn() },
};

const mockQueue = { add: jest.fn() };

describe("NotificationsService", () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken("notifications"), useValue: mockQueue },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  describe("resolveChannels", () => {
    it("returns defaults when no preference saved", async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);

      const channels = await service.resolveChannels(
        "org-1",
        "user-1",
        NotificationType.REPORT_READY,
      );

      expect(channels).toEqual({ inApp: true, email: false });
    });

    it("returns saved preference when present", async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        inApp: false,
        email: true,
      });

      const channels = await service.resolveChannels(
        "org-1",
        "user-1",
        NotificationType.LOW_STOCK,
      );

      expect(channels).toEqual({ inApp: false, email: true });
    });
  });

  describe("notifyUser", () => {
    it("skips in-app and email when both channels disabled", async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        inApp: false,
        email: false,
      });

      const result = await service.notifyUser({
        organizationId: "org-1",
        userId: "user-1",
        type: NotificationType.REPORT_READY,
        title: "Report ready",
        body: "Done",
      });

      expect(result).toBeNull();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("queues email only when in-app disabled", async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        inApp: false,
        email: true,
      });

      await service.notifyUser({
        organizationId: "org-1",
        userId: "user-1",
        type: NotificationType.LOW_STOCK,
        title: "Low stock",
        body: "Rice is low",
      });

      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith("email", expect.objectContaining({ userId: "user-1" }));
    });
  });

  describe("listPreferences", () => {
    it("merges saved rows with defaults for all types", async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValue([
        {
          type: NotificationType.REPORT_READY,
          inApp: true,
          email: true,
        },
      ]);

      const prefs = await service.listPreferences("org-1", "user-1");

      expect(prefs).toHaveLength(5);
      const reportReady = prefs.find((p) => p.type === NotificationType.REPORT_READY);
      expect(reportReady?.email).toBe(true);
      expect(reportReady?.isDefault).toBe(false);
      const lowStock = prefs.find((p) => p.type === NotificationType.LOW_STOCK);
      expect(lowStock?.email).toBe(true);
      expect(lowStock?.isDefault).toBe(true);
    });
  });

  describe("updatePreference", () => {
    it("rejects unknown notification type", async () => {
      await expect(
        service.updatePreference("org-1", "user-1", "UNKNOWN", { inApp: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it("upserts preference row", async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
      mockPrisma.notificationPreference.upsert.mockResolvedValue({
        type: NotificationType.LOW_STOCK,
        inApp: false,
        email: true,
      });

      const result = await service.updatePreference(
        "org-1",
        "user-1",
        NotificationType.LOW_STOCK,
        { inApp: false },
      );

      expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalled();
      expect(result.inApp).toBe(false);
      expect(result.isDefault).toBe(false);
    });
  });
});

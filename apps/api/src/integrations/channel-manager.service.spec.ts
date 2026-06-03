import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ChannelManagerService } from "./channel-manager.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const mockPrisma = {
  integrationConnection: { findFirst: jest.fn() },
  room: { findMany: jest.fn(), findFirst: jest.fn() },
  roomType: { findFirst: jest.fn() },
  reservation: { findMany: jest.fn() },
  channelAvailabilityBlock: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
};

const mockAudit = { record: jest.fn() };

describe("ChannelManagerService", () => {
  let service: ChannelManagerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelManagerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(ChannelManagerService);
  });

  const channelConnection = {
    id: "int-1",
    organizationId: "org-1",
    branchId: "branch-1",
    adapterKey: "channel_manager",
  };

  describe("exportAvailability", () => {
    it("rejects non-channel adapter", async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue({
        ...channelConnection,
        adapterKey: "generic_webhook",
      });
      await expect(
        service.exportAvailability("org-1", "int-1", "2026-07-01", "2026-07-03"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("returns inventory by room type", async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue(channelConnection);
      mockPrisma.room.findMany.mockResolvedValue([
        {
          id: "rm-1",
          roomTypeId: "rt-1",
          roomType: { name: "Standard" },
        },
        {
          id: "rm-2",
          roomTypeId: "rt-1",
          roomType: { name: "Standard" },
        },
      ]);
      mockPrisma.reservation.findMany.mockResolvedValue([
        {
          roomId: "rm-1",
          status: "CONFIRMED",
          checkIn: new Date("2026-07-01T14:00:00Z"),
          checkOut: new Date("2026-07-02T11:00:00Z"),
        },
      ]);
      mockPrisma.channelAvailabilityBlock.findMany.mockResolvedValue([]);

      const result = await service.exportAvailability(
        "org-1",
        "int-1",
        "2026-07-01",
        "2026-07-03",
      );

      expect(result.roomTypes).toHaveLength(1);
      expect(result.roomTypes[0].inventory).toHaveLength(2);
      const july1 = result.roomTypes[0].inventory.find((d) => d.date === "2026-07-01");
      expect(july1?.availableCount).toBe(1);
      expect(july1?.blockedCount).toBe(1);
    });
  });

  describe("createBlock", () => {
    it("creates block and audits", async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue(channelConnection);
      mockPrisma.channelAvailabilityBlock.create.mockResolvedValue({
        id: "cab-1",
        branchId: "branch-1",
        connectionId: "int-1",
        roomId: null,
        roomTypeId: null,
        startDate: new Date("2026-08-01T00:00:00.000Z"),
        endDate: new Date("2026-08-05T00:00:00.000Z"),
        reason: "Renovation",
        createdAt: new Date(),
      });

      const block = await service.createBlock("org-1", "int-1", "user-1", {
        startDate: "2026-08-01",
        endDate: "2026-08-05",
        reason: "Renovation",
      });

      expect(block.id).toBe("cab-1");
      expect(mockAudit.record).toHaveBeenCalled();
    });

    it("throws when connection missing", async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);
      await expect(
        service.createBlock("org-1", "missing", "user-1", {
          startDate: "2026-08-01",
          endDate: "2026-08-02",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { AuditService } from "./audit.service";
import { PrismaService } from "../prisma/prisma.service";

jest.mock("@erp/utils", () => ({
  generatePrefixedId: jest.fn(() => "aud_test_001"),
}));

const mockPrisma = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe("AuditService", () => {
  let service: AuditService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(AuditService);
  });

  describe("record", () => {
    it("persists audit row with generated id", async () => {
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.record({
        organizationId: "org-1",
        userId: "user-1",
        action: "CREATE",
        entityType: "branch",
        entityId: "br-1",
        metadata: { name: "Annex" },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "aud_test_001",
          organizationId: "org-1",
          userId: "user-1",
          action: "CREATE",
          entityType: "branch",
          entityId: "br-1",
          metadata: { name: "Annex" },
        }),
      });
    });

    it("does not throw when prisma create fails", async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error("db down"));

      await expect(
        service.record({
          organizationId: "org-1",
          action: "DELETE",
          entityType: "room",
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("list", () => {
    it("applies entityType filter and caps limit at 500", async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await service.list("org-1", { entityType: "reservation", limit: 9999 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: "org-1", entityType: "reservation" },
          take: 500,
        }),
      );
    });

    it("parses from/to date filters when valid", async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await service.list("org-1", {
        from: "2026-01-01",
        to: "2026-01-31",
        limit: 50,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
          take: 50,
        }),
      );
    });
  });
});

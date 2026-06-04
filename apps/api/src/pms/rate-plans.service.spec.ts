import { BadRequestException, NotFoundException } from "@nestjs/common";
import { RatePlansService } from "./rate-plans.service";
import { AuditService } from "../audit/audit.service";

const mockPrisma = {
  ratePlan: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  rateRule: {
    create: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
  roomType: { findFirst: jest.fn() },
  inclusionPackage: { findFirst: jest.fn() },
};

const mockAudit = { record: jest.fn().mockResolvedValue(undefined) };

describe("RatePlansService", () => {
  let service: RatePlansService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RatePlansService(mockPrisma as never, mockAudit as never);
  });

  const validFrom = "2026-06-01";
  const validTo = "2026-12-31";

  describe("create", () => {
    it("rejects validTo before validFrom", async () => {
      mockPrisma.roomType.findFirst.mockResolvedValue({ id: "rt_1" });

      await expect(
        service.create("org-1", {
          roomTypeId: "rt_1",
          name: "Summer",
          validFrom: validTo,
          validTo: validFrom,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects non-positive baseModifier", async () => {
      mockPrisma.roomType.findFirst.mockResolvedValue({ id: "rt_1" });

      await expect(
        service.create("org-1", {
          roomTypeId: "rt_1",
          name: "Summer",
          validFrom,
          validTo,
          baseModifier: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates plan and records audit", async () => {
      mockPrisma.roomType.findFirst.mockResolvedValue({ id: "rt_1" });
      mockPrisma.ratePlan.create.mockResolvedValue({
        id: "rp_1",
        name: "Summer",
        roomType: {},
        inclusionPackage: null,
        rules: [],
      });

      const plan = await service.create(
        "org-1",
        {
          roomTypeId: "rt_1",
          name: "Summer",
          validFrom,
          validTo,
        },
        "user-1",
      );

      expect(plan.id).toBe("rp_1");
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          userId: "user-1",
          entityType: "rate_plan",
          entityId: "rp_1",
        }),
      );
    });
  });

  describe("addRule", () => {
    it("rejects invalid dayOfWeek", async () => {
      mockPrisma.ratePlan.findFirst.mockResolvedValue({
        id: "rp_1",
        validFrom: new Date(validFrom),
        validTo: new Date(validTo),
      });

      await expect(
        service.addRule("org-1", "rp_1", { dayOfWeek: 7 }),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates rule when plan exists", async () => {
      mockPrisma.ratePlan.findFirst.mockResolvedValue({
        id: "rp_1",
        validFrom: new Date(validFrom),
        validTo: new Date(validTo),
      });
      mockPrisma.rateRule.create.mockResolvedValue({ id: "rr_1", ratePlanId: "rp_1" });

      const rule = await service.addRule("org-1", "rp_1", {
        dayOfWeek: 6,
        pricePerNight: 4200,
      });

      expect(rule.id).toBe("rr_1");
    });
  });

  describe("delete", () => {
    it("throws when plan not in organization", async () => {
      mockPrisma.ratePlan.findFirst.mockResolvedValue(null);

      await expect(service.delete("org-1", "rp_missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

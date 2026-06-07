import { NotFoundException } from "@nestjs/common";
import { Role } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { PmsController } from "./pms.controller";
import { PmsService } from "./pms.service";
import { AvailabilityService } from "./availability.service";
import { RatePlansService } from "./rate-plans.service";
import { RatePricingService } from "./rate-pricing.service";
import { TenantScopeService } from "../common/tenant/tenant-scope.service";

const tenant: TenantContext = {
  organizationId: "org_a",
  branchId: "br_a1",
  userId: "usr_1",
  role: Role.OWNER,
};

describe("PmsController", () => {
  const mockPms = {} as PmsService;
  const mockAvailability = { findAvailableRooms: jest.fn() } as unknown as AvailabilityService;
  const mockRatePlans = {} as RatePlansService;
  const mockPricing = { quoteStay: jest.fn() } as unknown as RatePricingService;
  const mockTenantScope = {
    resolveBranchId: jest.fn().mockResolvedValue("br_a1"),
    assertRoomInOrganization: jest.fn().mockResolvedValue(undefined),
    assertRoomTypeInOrganization: jest.fn().mockResolvedValue(undefined),
    assertReservationInBranch: jest.fn().mockResolvedValue(undefined),
  } as unknown as TenantScopeService;

  let controller: PmsController;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockTenantScope.resolveBranchId as jest.Mock).mockResolvedValue("br_a1");
    (mockTenantScope.assertRoomInOrganization as jest.Mock).mockResolvedValue(undefined);
    (mockTenantScope.assertRoomTypeInOrganization as jest.Mock).mockResolvedValue(undefined);
    (mockTenantScope.assertReservationInBranch as jest.Mock).mockResolvedValue(undefined);
    (mockPricing.quoteStay as jest.Mock).mockResolvedValue({ totalAmount: 100 });
    (mockAvailability.findAvailableRooms as jest.Mock).mockResolvedValue([]);

    controller = new PmsController(
      mockPms,
      mockAvailability,
      mockRatePlans,
      mockPricing,
      mockTenantScope,
    );
  });

  describe("quote", () => {
    it("rejects room from another organization before quoting", async () => {
      (mockTenantScope.assertRoomInOrganization as jest.Mock).mockRejectedValue(
        new NotFoundException("Room not found"),
      );

      await expect(
        controller.quote(
          tenant,
          "room_foreign",
          "2026-06-01T14:00:00Z",
          "2026-06-03T11:00:00Z",
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockPricing.quoteStay).not.toHaveBeenCalled();
    });

    it("quotes when room belongs to tenant organization", async () => {
      const result = await controller.quote(
        tenant,
        "room_a",
        "2026-06-01T14:00:00Z",
        "2026-06-03T11:00:00Z",
        "2",
        "1",
      );

      expect(mockTenantScope.assertRoomInOrganization).toHaveBeenCalledWith("org_a", "room_a");
      expect(mockPricing.quoteStay).toHaveBeenCalledWith(
        "room_a",
        new Date("2026-06-01T14:00:00Z"),
        new Date("2026-06-03T11:00:00Z"),
        2,
        1,
      );
      expect(result).toEqual({ totalAmount: 100 });
    });
  });

  describe("getAvailability", () => {
    it("rejects roomTypeId from another organization", async () => {
      (mockTenantScope.assertRoomTypeInOrganization as jest.Mock).mockRejectedValue(
        new NotFoundException("Room type not found"),
      );

      await expect(
        controller.getAvailability(
          "br_a1",
          "2026-06-01T14:00:00Z",
          "2026-06-03T11:00:00Z",
          "rt_foreign",
          undefined,
          tenant,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockAvailability.findAvailableRooms).not.toHaveBeenCalled();
    });

    it("validates roomTypeId then queries availability", async () => {
      await controller.getAvailability(
        "br_a1",
        "2026-06-01T14:00:00Z",
        "2026-06-03T11:00:00Z",
        "rt_001",
        undefined,
        tenant,
      );

      expect(mockTenantScope.assertRoomTypeInOrganization).toHaveBeenCalledWith(
        "org_a",
        "rt_001",
      );
      expect(mockAvailability.findAvailableRooms).toHaveBeenCalledWith({
        branchId: "br_a1",
        checkIn: new Date("2026-06-01T14:00:00Z"),
        checkOut: new Date("2026-06-03T11:00:00Z"),
        roomTypeId: "rt_001",
        excludeReservationId: undefined,
      });
    });

    it("rejects excludeReservationId from another branch", async () => {
      (mockTenantScope.assertReservationInBranch as jest.Mock).mockRejectedValue(
        new NotFoundException("Reservation not found"),
      );

      await expect(
        controller.getAvailability(
          "br_a1",
          "2026-06-01T14:00:00Z",
          "2026-06-03T11:00:00Z",
          undefined,
          "rsv_foreign",
          tenant,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockTenantScope.assertReservationInBranch).toHaveBeenCalledWith(
        "br_a1",
        "rsv_foreign",
      );
      expect(mockAvailability.findAvailableRooms).not.toHaveBeenCalled();
    });
  });
});

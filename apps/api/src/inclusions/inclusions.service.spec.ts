import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import {
  InclusionConsumptionSource,
  InclusionType,
  MovementType,
  ReservationStatus,
} from "@erp/types";
import { InclusionsService } from "./inclusions.service";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { TenantScopeService } from "../common/tenant/tenant-scope.service";
import { countStayNights } from "./inclusions.constants";

jest.mock("@erp/utils", () => ({
  toNumber: (v: unknown) => Number(v),
  generatePrefixedId: () => "irl_test",
}));

const mockPrisma = {
  inclusionPackage: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  inclusionPackageRule: { deleteMany: jest.fn() },
  inclusionRecipe: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  reservation: { findUnique: jest.fn(), findFirst: jest.fn() },
  reservationAllowance: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  inclusionConsumption: { create: jest.fn() },
};

const mockInventory = {
  createMovement: jest.fn(),
  assertItemInPool: jest.fn().mockResolvedValue({ id: "item-1" }),
};

const mockTenantScope = {
  assertReservationInBranch: jest.fn().mockResolvedValue(undefined),
};

const mealRecipe = {
  id: "ir-meal",
  branchId: "branch-1",
  name: "Guest meal",
  inclusionType: InclusionType.MEAL,
  lines: [{ inventoryItemId: "inv-rice", quantity: 0.2 }],
};

describe("InclusionsService", () => {
  let service: InclusionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTenantScope.assertReservationInBranch.mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InclusionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventory },
        { provide: TenantScopeService, useValue: mockTenantScope },
      ],
    }).compile();
    service = module.get<InclusionsService>(InclusionsService);
  });

  describe("countStayNights", () => {
    it("counts calendar nights with minimum 1", () => {
      expect(
        countStayNights(new Date("2026-06-01T14:00:00Z"), new Date("2026-06-03T11:00:00Z")),
      ).toBe(2);
      expect(
        countStayNights(new Date("2026-06-01T14:00:00Z"), new Date("2026-06-02T11:00:00Z")),
      ).toBe(1);
    });
  });

  describe("snapshotAllowances", () => {
    it("computes meal entitlement from headcount, nights, and package rule", async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: "res-1",
        branchId: "branch-1",
        adultCount: 2,
        childCount: 0,
        mealsPerGuestPerNightOverride: null,
        checkIn: new Date("2026-06-01T14:00:00Z"),
        checkOut: new Date("2026-06-03T11:00:00Z"),
        package: {
          rules: [
            {
              inclusionType: InclusionType.MEAL,
              inclusionRecipeId: "ir-meal",
              quantityPerGuestPerNight: 3,
              quantityPerGuestPerStay: null,
            },
          ],
        },
        branch: { organizationId: "org-1" },
      });
      mockPrisma.inclusionRecipe.findFirst.mockResolvedValue(mealRecipe);
      mockPrisma.reservationAllowance.upsert.mockResolvedValue({
        id: "ra-1",
        entitledQty: 12,
        consumedQty: 0,
      });

      await service.snapshotAllowances("res-1");

      expect(mockPrisma.reservationAllowance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ entitledQty: 12 }),
        }),
      );
    });

    it("uses mealsPerGuestPerNightOverride when set", async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: "res-1",
        branchId: "branch-1",
        adultCount: 2,
        childCount: 0,
        mealsPerGuestPerNightOverride: 1,
        checkIn: new Date("2026-06-01T14:00:00Z"),
        checkOut: new Date("2026-06-03T11:00:00Z"),
        package: {
          rules: [
            {
              inclusionType: InclusionType.MEAL,
              inclusionRecipeId: "ir-meal",
              quantityPerGuestPerNight: 3,
            },
          ],
        },
        branch: { organizationId: "org-1" },
      });
      mockPrisma.inclusionRecipe.findFirst.mockResolvedValue(mealRecipe);
      mockPrisma.reservationAllowance.upsert.mockResolvedValue({ id: "ra-1" });

      await service.snapshotAllowances("res-1");

      expect(mockPrisma.reservationAllowance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ entitledQty: 4 }),
        }),
      );
    });
  });

  describe("consumeManual", () => {
    it("blocks consumption above entitlement", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: "res-1",
        branchId: "branch-1",
        status: ReservationStatus.CHECKED_IN,
      });
      mockPrisma.reservationAllowance.findUnique.mockResolvedValue({
        id: "ra-1",
        entitledQty: 6,
        consumedQty: 6,
      });

      await expect(
        service.consumeManual("branch-1", "res-1", {
          inclusionType: InclusionType.MEAL,
          inclusionRecipeId: "ir-meal",
          quantity: 1,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("deducts inventory on successful consume", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: "res-1",
        branchId: "branch-1",
        status: ReservationStatus.CHECKED_IN,
      });
      mockPrisma.reservationAllowance.findUnique.mockResolvedValue({
        id: "ra-1",
        entitledQty: 6,
        consumedQty: 0,
      });
      mockPrisma.inclusionRecipe.findFirst.mockResolvedValue(mealRecipe);
      mockPrisma.inclusionConsumption.create.mockResolvedValue({ id: "ic-1" });
      mockPrisma.reservationAllowance.update.mockResolvedValue({});
      mockInventory.createMovement.mockResolvedValue({});

      await service.consumeManual("branch-1", "res-1", {
        inclusionType: InclusionType.MEAL,
        inclusionRecipeId: "ir-meal",
        quantity: 2,
      });

      expect(mockInventory.createMovement).toHaveBeenCalledWith({
        itemId: "inv-rice",
        branchId: "branch-1",
        movementType: MovementType.GUEST_INCLUSION,
        quantity: 0.4,
        referenceType: "InclusionConsumption",
        referenceId: "ic-1",
      });
    });
  });
});

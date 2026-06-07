import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Role } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { TenantScopeService } from "./tenant-scope.service";
import { UserBranchStatus } from "../../tenants/branch-access.constants";

const mockPrisma = {
  branch: { findFirst: jest.fn(), findUnique: jest.fn() },
  userBranch: { findUnique: jest.fn() },
  guest: { findFirst: jest.fn() },
  roomType: { findFirst: jest.fn() },
  room: { findFirst: jest.fn() },
  account: { findFirst: jest.fn(), count: jest.fn() },
  menuItem: { findUnique: jest.fn() },
  employee: { findFirst: jest.fn() },
  reservation: { findFirst: jest.fn() },
  order: { findFirst: jest.fn() },
};

const ownerTenant: TenantContext = {
  organizationId: "org_a",
  branchId: "br_a1",
  userId: "usr_1",
  role: Role.OWNER,
};

const cashierTenant: TenantContext = {
  organizationId: "org_a",
  branchId: "br_a1",
  userId: "usr_2",
  role: Role.CASHIER,
};

describe("TenantScopeService", () => {
  let service: TenantScopeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantScopeService(mockPrisma as never);
    mockPrisma.branch.findFirst.mockResolvedValue({
      id: "br_a1",
      organizationId: "org_a",
    });
    mockPrisma.userBranch.findUnique.mockResolvedValue({
      userId: "usr_2",
      branchId: "br_a1",
      organizationId: "org_a",
      status: UserBranchStatus.ACTIVE,
    });
  });

  describe("resolveBranchId", () => {
    it("uses tenant header branch when no override", async () => {
      const result = await service.resolveBranchId(ownerTenant);
      expect(result).toBe("br_a1");
      expect(mockPrisma.branch.findFirst).toHaveBeenCalledWith({
        where: { id: "br_a1", organizationId: "org_a" },
      });
    });

    it("uses query override when provided", async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({
        id: "br_a2",
        organizationId: "org_a",
      });
      const result = await service.resolveBranchId(ownerTenant, "br_a2");
      expect(result).toBe("br_a2");
    });

    it("rejects branch from another organization", async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      await expect(service.resolveBranchId(ownerTenant, "br_other_org")).rejects.toThrow(
        new ForbiddenException("Branch does not belong to this organization"),
      );
    });

    it("requires branch when none provided and required=true", async () => {
      const tenant = { ...ownerTenant, branchId: undefined };
      await expect(service.resolveBranchId(tenant)).rejects.toThrow(
        new BadRequestException("branchId is required"),
      );
    });

    it("returns undefined when branch optional and missing", async () => {
      const tenant = { ...ownerTenant, branchId: undefined };
      await expect(service.resolveBranchId(tenant, undefined, { required: false })).resolves.toBe(
        undefined,
      );
      expect(mockPrisma.branch.findFirst).not.toHaveBeenCalled();
    });

    it("rejects non-admin without branch grant", async () => {
      mockPrisma.userBranch.findUnique.mockResolvedValue(null);
      await expect(service.resolveBranchId(cashierTenant, "br_a2")).rejects.toThrow(
        new ForbiddenException("You do not have access to this branch"),
      );
    });

    it("allows non-admin with active branch grant", async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({
        id: "br_a2",
        organizationId: "org_a",
      });
      mockPrisma.userBranch.findUnique.mockResolvedValue({
        userId: "usr_2",
        branchId: "br_a2",
        organizationId: "org_a",
        status: UserBranchStatus.ACTIVE,
      });
      await expect(service.resolveBranchId(cashierTenant, "br_a2")).resolves.toBe("br_a2");
    });

    it("rejects non-admin with grant for wrong organization", async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({
        id: "br_a2",
        organizationId: "org_a",
      });
      mockPrisma.userBranch.findUnique.mockResolvedValue({
        userId: "usr_2",
        branchId: "br_a2",
        organizationId: "org_other",
        status: UserBranchStatus.ACTIVE,
      });
      await expect(service.resolveBranchId(cashierTenant, "br_a2")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("assertBranchInOrganization", () => {
    it("passes when branch belongs to org", async () => {
      await expect(
        service.assertBranchInOrganization("org_a", "br_a1"),
      ).resolves.toBeUndefined();
    });

    it("throws when branch does not belong to org", async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      await expect(service.assertBranchInOrganization("org_a", "br_b1")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("entity assertions", () => {
    it("assertGuestInOrganization rejects guest from another org", async () => {
      mockPrisma.guest.findFirst.mockResolvedValue(null);
      await expect(service.assertGuestInOrganization("org_a", "guest-b")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("assertRoomTypeInOrganization rejects room type from another org", async () => {
      mockPrisma.roomType.findFirst.mockResolvedValue(null);
      await expect(service.assertRoomTypeInOrganization("org_a", "rt-b")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("assertRoomInBranch rejects room from another branch", async () => {
      mockPrisma.room.findFirst.mockResolvedValue(null);
      await expect(service.assertRoomInBranch("br_a1", "room-b")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("assertMenuItemInBranch rejects item from another branch", async () => {
      mockPrisma.menuItem.findUnique.mockResolvedValue({
        id: "mi-b",
        category: { organizationId: "org_b", branchId: "br_b1" },
      });
      await expect(service.assertMenuItemInBranch("org_a", "br_a1", "mi-b")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("assertReservationInBranch rejects reservation from another branch", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue(null);
      await expect(service.assertReservationInBranch("br_a1", "rsv-b")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("assertOrderInBranch rejects order from another branch", async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);
      await expect(service.assertOrderInBranch("br_a1", "ord-b")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("assertRoomInOrganization rejects room from another org", async () => {
      mockPrisma.room.findFirst.mockResolvedValue(null);
      await expect(service.assertRoomInOrganization("org_a", "room-b")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("assertRoomInOrganization passes for room in org", async () => {
      mockPrisma.room.findFirst.mockResolvedValue({ id: "room-a" });
      await expect(
        service.assertRoomInOrganization("org_a", "room-a"),
      ).resolves.toBeUndefined();
    });

    it("assertAccountInOrganization rejects account from another org", async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);
      await expect(service.assertAccountInOrganization("org_a", "acc-b")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("assertAccountsInOrganization rejects when any account is foreign", async () => {
      mockPrisma.account.count.mockResolvedValue(1);
      await expect(
        service.assertAccountsInOrganization("org_a", ["acc-1", "acc-2"]),
      ).rejects.toThrow(NotFoundException);
    });

    it("assertAccountsInOrganization passes when all accounts belong to org", async () => {
      mockPrisma.account.count.mockResolvedValue(2);
      await expect(
        service.assertAccountsInOrganization("org_a", ["acc-1", "acc-2", "acc-1"]),
      ).resolves.toBeUndefined();
      expect(mockPrisma.account.count).toHaveBeenCalledWith({
        where: { organizationId: "org_a", id: { in: ["acc-1", "acc-2"] } },
      });
    });
  });
});

import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Role } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { TenantScopeService } from "./tenant-scope.service";
import { UserBranchStatus } from "../../tenants/branch-access.constants";

const mockPrisma = {
  branch: { findFirst: jest.fn() },
  userBranch: { findUnique: jest.fn() },
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
});

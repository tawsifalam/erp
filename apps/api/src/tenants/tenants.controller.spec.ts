import { ForbiddenException } from "@nestjs/common";
import { Role } from "@erp/types";
import { TenantsController } from "./tenants.controller";

const mockTenants = {
  getOnboardingStatus: jest.fn(),
  searchOrganizations: jest.fn(),
  getOrganizationByJoinCode: jest.fn(),
  listOrganizations: jest.fn(),
  countMemberships: jest.fn(),
  createOrganization: jest.fn(),
  getOrganization: jest.fn(),
  updateOrganization: jest.fn(),
  createJoinRequest: jest.fn(),
  listBranches: jest.fn(),
  createBranch: jest.fn(),
  updateBranch: jest.fn(),
  deleteBranch: jest.fn(),
};

const mockPrisma = {
  user: { findUnique: jest.fn() },
  userOrganization: { findFirst: jest.fn() },
};

describe("TenantsController", () => {
  let controller: TenantsController;

  const claims = { userId: "pa_user_1", email: "owner@example.com" };
  const erpUser = { id: "usr_1", propelAuthUserId: "pa_user_1", email: "owner@example.com" };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TenantsController(mockTenants as never, mockPrisma as never);
    mockPrisma.user.findUnique.mockResolvedValue(erpUser);
  });

  describe("onboardingStatus", () => {
    it("returns no access when ERP user does not exist yet", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await controller.onboardingStatus(claims);

      expect(result).toEqual({
        hasMembership: false,
        canAccessApp: false,
        pendingRequest: null,
      });
      expect(mockTenants.getOnboardingStatus).not.toHaveBeenCalled();
    });

    it("delegates to service when user exists", async () => {
      mockTenants.getOnboardingStatus.mockResolvedValue({
        hasMembership: true,
        canAccessApp: true,
        pendingRequest: null,
      });

      const result = await controller.onboardingStatus(claims);

      expect(mockTenants.getOnboardingStatus).toHaveBeenCalledWith("usr_1");
      expect(result.canAccessApp).toBe(true);
    });
  });

  describe("organizations", () => {
    it("returns empty list when user not synced", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await controller.organizations(claims);

      expect(result).toEqual([]);
    });

    it("lists memberships for synced user", async () => {
      mockTenants.listOrganizations.mockResolvedValue([{ organizationId: "org_1" }]);

      const result = await controller.organizations(claims);

      expect(mockTenants.listOrganizations).toHaveBeenCalledWith("usr_1");
      expect(result).toHaveLength(1);
    });
  });

  describe("createOrganization", () => {
    it("creates first organization without admin check", async () => {
      mockTenants.countMemberships.mockResolvedValue(0);
      mockTenants.createOrganization.mockResolvedValue({
        organization: { id: "org_new", branches: [{ id: "br_1" }] },
        propelAuthSynced: true,
      });

      const result = await controller.createOrganization(claims, {
        name: "New Hotel",
        timezone: "Asia/Dhaka",
      });

      expect(mockTenants.createOrganization).toHaveBeenCalledWith("usr_1", {
        name: "New Hotel",
        timezone: "Asia/Dhaka",
      });
      expect(result?.organization.id).toBe("org_new");
    });

    it("requires OWNER/ADMIN to create additional organizations", async () => {
      mockTenants.countMemberships.mockResolvedValue(1);
      mockPrisma.userOrganization.findFirst.mockResolvedValue(null);

      await expect(
        controller.createOrganization(claims, {
          name: "Second Org",
          timezone: "Asia/Dhaka",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("allows admin with existing membership to create another org", async () => {
      mockTenants.countMemberships.mockResolvedValue(1);
      mockPrisma.userOrganization.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockTenants.createOrganization.mockResolvedValue({
        organization: { id: "org_2" },
        propelAuthSynced: true,
      });

      await controller.createOrganization(claims, {
        name: "Second Org",
        timezone: "Asia/Dhaka",
      });

      expect(mockTenants.createOrganization).toHaveBeenCalled();
    });

    it("returns null when JWT user is not synced to ERP", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await controller.createOrganization(claims, {
        name: "Ghost",
        timezone: "Asia/Dhaka",
      });

      expect(result).toBeNull();
    });
  });

  describe("updateCurrentOrganization", () => {
    it("updates organization name for tenant", async () => {
      mockTenants.updateOrganization.mockResolvedValue({ id: "org_1", name: "Renamed" });

      const result = await controller.updateCurrentOrganization(
        { organizationId: "org_1", userId: "usr_1", role: Role.OWNER },
        { name: "Renamed" },
      );

      expect(mockTenants.updateOrganization).toHaveBeenCalledWith(
        "org_1",
        { name: "Renamed" },
        "usr_1",
      );
      expect(result.name).toBe("Renamed");
    });
  });

  describe("branches", () => {
    const tenant = { organizationId: "org_1", userId: "usr_1", role: Role.OWNER };

    it("lists branches for organization", async () => {
      mockTenants.listBranches.mockResolvedValue([{ id: "br_1" }]);

      const result = await controller.listBranches(tenant as never);

      expect(mockTenants.listBranches).toHaveBeenCalledWith("org_1");
      expect(result).toHaveLength(1);
    });

    it("creates branch with tenant context", async () => {
      mockTenants.createBranch.mockResolvedValue({ id: "br_new", name: "Annex" });

      const result = await controller.createBranch(tenant as never, {
        name: "Annex",
        timezone: "Asia/Dhaka",
      });

      expect(mockTenants.createBranch).toHaveBeenCalledWith(
        "org_1",
        { name: "Annex", timezone: "Asia/Dhaka" },
        "usr_1",
      );
      expect(result.id).toBe("br_new");
    });

    it("updates branch in organization", async () => {
      mockTenants.updateBranch.mockResolvedValue({ id: "br_1", name: "Updated" });

      const result = await controller.updateBranch(tenant as never, "br_1", {
        name: "Updated",
      });

      expect(mockTenants.updateBranch).toHaveBeenCalledWith(
        "br_1",
        "org_1",
        { name: "Updated" },
        "usr_1",
      );
      expect(result.name).toBe("Updated");
    });

    it("deletes branch in organization", async () => {
      mockTenants.deleteBranch.mockResolvedValue({ deleted: true, id: "br_2" });

      const result = await controller.deleteBranch(tenant as never, "br_2");

      expect(mockTenants.deleteBranch).toHaveBeenCalledWith("br_2", "org_1", "usr_1");
      expect(result.deleted).toBe(true);
    });
  });
});

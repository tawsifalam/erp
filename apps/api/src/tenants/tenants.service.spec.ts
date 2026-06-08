import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { TenantsService } from "./tenants.service";

const mockPrisma = {
  user: { findUnique: jest.fn(), upsert: jest.fn() },
  userOrganization: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  organization: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  organizationJoinRequest: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  organizationInvite: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  branch: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  userBranch: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  reservation: { count: jest.fn() },
  employee: { updateMany: jest.fn() },
  reportJob: { updateMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockInventoryPools = {
  seedDefaultPools: jest.fn().mockResolvedValue(undefined),
};

const mockTokens = {
  signInviteToken: jest.fn().mockResolvedValue("invite-jwt"),
};

const mockEmailAuth = {
  sendInviteEmail: jest.fn().mockResolvedValue(undefined),
};

describe("TenantsService", () => {
  let service: TenantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    const mockAudit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new TenantsService(
      mockPrisma as never,
      mockInventoryPools as never,
      mockAudit as never,
      mockTokens as never,
      mockEmailAuth as never,
    );
  });

  it("listBranches returns branches for organization", async () => {
    mockPrisma.branch.findMany.mockResolvedValue([{ id: "br_1", name: "Main" }]);
    const result = await service.listBranches("org_1");
    expect(result).toHaveLength(1);
    expect(mockPrisma.branch.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      orderBy: { name: "asc" },
    });
  });

  it("createBranch creates with trimmed organizationId", async () => {
    mockPrisma.branch.create.mockResolvedValue({
      id: "br_new",
      name: "Annex",
      timezone: "Asia/Dhaka",
    });
    const result = await service.createBranch("org_1", {
      name: "  Annex  ",
      timezone: " Asia/Dhaka ",
    });
    expect(result.name).toBe("Annex");
    expect(mockPrisma.branch.create).toHaveBeenCalledWith({
      data: { organizationId: "org_1", name: "Annex", timezone: "Asia/Dhaka" },
    });
  });

  it("createBranch rejects empty name", async () => {
    await expect(
      service.createBranch("org_1", { name: "  ", timezone: "Asia/Dhaka" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("createBranch rejects empty timezone", async () => {
    await expect(
      service.createBranch("org_1", { name: "Annex", timezone: "" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("updateBranch throws when branch not in org", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue(null);
    await expect(
      service.updateBranch("br_x", "org_1", { name: "X" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("updateBranch updates when found", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: "br_1" });
    mockPrisma.branch.update.mockResolvedValue({ id: "br_1", name: "Updated" });
    const result = await service.updateBranch("br_1", "org_1", { name: "Updated" });
    expect(result.name).toBe("Updated");
  });

  it("updateBranch rejects empty name", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: "br_1" });
    await expect(
      service.updateBranch("br_1", "org_1", { name: "   " }),
    ).rejects.toThrow(BadRequestException);
  });

  it("deleteBranch deletes when branch exists with multiple branches and no active reservations", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: "br_2", organizationId: "org_1" });
    mockPrisma.branch.count.mockResolvedValue(2);
    mockPrisma.reservation.count.mockResolvedValue(0);
    const tx = {
      employee: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      reportJob: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      branch: { delete: jest.fn().mockResolvedValue({ id: "br_2" }) },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

    const result = await service.deleteBranch("br_2", "org_1");

    expect(result).toEqual({ deleted: true, id: "br_2" });
    expect(tx.employee.updateMany).toHaveBeenCalledWith({
      where: { branchId: "br_2" },
      data: { branchId: null },
    });
    expect(tx.reportJob.updateMany).toHaveBeenCalledWith({
      where: { branchId: "br_2" },
      data: { branchId: null },
    });
    expect(tx.branch.delete).toHaveBeenCalledWith({ where: { id: "br_2" } });
  });

  it("deleteBranch throws when branch not in org", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue(null);
    await expect(service.deleteBranch("br_x", "org_1")).rejects.toThrow(NotFoundException);
  });

  it("deleteBranch throws when last branch in org", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: "br_1", organizationId: "org_1" });
    mockPrisma.branch.count.mockResolvedValue(1);
    await expect(service.deleteBranch("br_1", "org_1")).rejects.toThrow(BadRequestException);
  });

  it("deleteBranch throws when branch has active reservations", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: "br_2", organizationId: "org_1" });
    mockPrisma.branch.count.mockResolvedValue(2);
    mockPrisma.reservation.count.mockResolvedValue(3);
    await expect(service.deleteBranch("br_2", "org_1")).rejects.toThrow(ConflictException);
  });

  it("updateOrganization rejects empty name", async () => {
    await expect(service.updateOrganization("org_1", { name: "  " })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("updateOrganization updates organization name", async () => {
    mockPrisma.organization.update.mockResolvedValue({
      id: "org_1",
      name: "Renamed Hotel",
      branches: [],
    });

    const result = await service.updateOrganization("org_1", { name: "Renamed Hotel" }, "usr_1");

    expect(result.name).toBe("Renamed Hotel");
  });

  it("getOnboardingStatus reports membership and pending request", async () => {
    mockPrisma.userOrganization.count.mockResolvedValue(1);
    mockPrisma.organizationJoinRequest.findFirst.mockResolvedValue(null);

    const status = await service.getOnboardingStatus("usr_1");

    expect(status).toEqual({
      hasMembership: true,
      canAccessApp: true,
      pendingRequest: null,
    });
  });

  it("createOrganization seeds pools and creates org with owner membership", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      const tx = {
        organization: {
          create: jest.fn().mockResolvedValue({
            id: "org_new",
            name: "Test Org",
            joinCode: "ov_abc",
          }),
        },
        branch: {
          create: jest.fn().mockResolvedValue({
            id: "br_main",
            name: "Main Branch",
            timezone: "Asia/Dhaka",
          }),
        },
        userOrganization: { create: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx as never);
    });

    const result = await service.createOrganization("user_1", {
      name: "Test Org",
      timezone: "Asia/Dhaka",
    });

    expect(mockInventoryPools.seedDefaultPools).toHaveBeenCalledWith("org_new");
    expect(result.organization.id).toBe("org_new");
  });

  it("createOrganization rejects missing name or timezone", async () => {
    await expect(
      service.createOrganization("user_1", { name: "", timezone: "Asia/Dhaka" }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createOrganization("user_1", { name: "Test", timezone: "" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("updateBranch updates timezone when provided", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: "br_1" });
    mockPrisma.branch.update.mockResolvedValue({
      id: "br_1",
      name: "Main",
      timezone: "Europe/London",
    });

    const result = await service.updateBranch("br_1", "org_1", { timezone: "Europe/London" });

    expect(mockPrisma.branch.update).toHaveBeenCalledWith({
      where: { id: "br_1" },
      data: { timezone: "Europe/London" },
    });
    expect(result.timezone).toBe("Europe/London");
  });

  it("updateBranch rejects empty timezone", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: "br_1" });
    await expect(
      service.updateBranch("br_1", "org_1", { timezone: "  " }),
    ).rejects.toThrow(BadRequestException);
  });

  it("createBranch records audit metadata", async () => {
    const mockAudit = { record: jest.fn().mockResolvedValue(undefined) };
    const auditedService = new TenantsService(
      mockPrisma as never,
      mockInventoryPools as never,
      mockAudit as never,
      mockTokens as never,
      mockEmailAuth as never,
    );
    mockPrisma.branch.create.mockResolvedValue({
      id: "br_new",
      name: "Annex",
      timezone: "Asia/Dhaka",
    });

    await auditedService.createBranch("org_1", { name: "Annex", timezone: "Asia/Dhaka" }, "usr_1");

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        userId: "usr_1",
        entityId: "br_new",
      }),
    );
  });

  it("approveJoinRequest creates membership with assigned role", async () => {
    mockPrisma.organizationJoinRequest.findFirst.mockResolvedValue({
      id: "ojr_1",
      userId: "usr_2",
      organizationId: "org_1",
      status: "PENDING",
      user: { id: "usr_2" },
    });
    mockPrisma.userOrganization.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      const tx = {
        userOrganization: { create: jest.fn().mockResolvedValue({}) },
        organizationJoinRequest: {
          update: jest.fn().mockResolvedValue({ id: "ojr_1", status: "APPROVED" }),
          updateMany: jest.fn().mockResolvedValue({}),
        },
      };
      return fn(tx as never);
    });

    await service.approveJoinRequest("usr_admin", "org_1", "ojr_1", "FRONT_DESK");
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("searchOrganizations requires min 2 chars", () => {
    expect(() => service.searchOrganizations("a")).toThrow(BadRequestException);
  });

  it("removeMember blocks removing the organization founder", async () => {
    mockPrisma.userOrganization.findFirst.mockResolvedValue({ userId: "usr_founder" });
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      id: "uo_1",
      userId: "usr_founder",
      role: "OWNER",
    });

    await expect(
      service.removeMember("org_1", "usr_founder", "usr_admin"),
    ).rejects.toThrow(ForbiddenException);
  });

  it("inviteMember sends email invite and records pending invite", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org_1",
      name: "Test Org",
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.organizationInvite.findFirst.mockResolvedValue(null);
    mockPrisma.organizationInvite.create.mockResolvedValue({
      id: "inv_1",
      email: "new@example.com",
      role: "FRONT_DESK",
    });

    await service.inviteMember("org_1", "usr_admin", {
      email: "new@example.com",
      role: "FRONT_DESK",
    });

    expect(mockTokens.signInviteToken).toHaveBeenCalled();
    expect(mockEmailAuth.sendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "new@example.com", organizationName: "Test Org" }),
    );
    expect(mockPrisma.organizationInvite.create).toHaveBeenCalled();
  });

  it("inviteMember rejects duplicate pending invite", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org_1",
      name: "Test",
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.organizationInvite.findFirst.mockResolvedValue({ id: "inv_existing" });

    await expect(
      service.inviteMember("org_1", "usr_admin", {
        email: "dup@example.com",
        role: "CASHIER",
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("removeMember deletes non-founder membership", async () => {
    mockPrisma.userOrganization.findFirst.mockResolvedValue({ userId: "usr_founder" });
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      id: "uo_2",
      userId: "usr_member",
      role: "FRONT_DESK",
    });
    mockPrisma.userOrganization.delete.mockResolvedValue({});

    const result = await service.removeMember("org_1", "usr_member", "usr_admin");

    expect(result.removed).toBe(true);
    expect(mockPrisma.userOrganization.delete).toHaveBeenCalledWith({ where: { id: "uo_2" } });
  });

  it("listOrganizations filters branches for non-admin members", async () => {
    mockPrisma.userOrganization.findMany.mockResolvedValue([
      {
        organizationId: "org_1",
        role: "FRONT_DESK",
        organization: {
          id: "org_1",
          name: "Demo",
          branches: [
            { id: "br_1", name: "Main" },
            { id: "br_2", name: "Annex" },
          ],
        },
      },
    ]);
    mockPrisma.userBranch.findMany.mockResolvedValue([{ branchId: "br_1" }]);

    const result = await service.listOrganizations("usr_front");

    expect(result[0].organization.branches).toEqual([{ id: "br_1", name: "Main" }]);
  });

  it("listBranchMembers returns members with access flags", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: "br_1", organizationId: "org_1" });
    mockPrisma.userOrganization.findMany.mockResolvedValue([
      {
        userId: "usr_admin",
        role: "ADMIN",
        user: { id: "usr_admin", email: "admin@test.com", name: "Admin" },
      },
      {
        userId: "usr_front",
        role: "FRONT_DESK",
        user: { id: "usr_front", email: "front@test.com", name: null },
      },
    ]);
    mockPrisma.userBranch.findMany.mockResolvedValue([{ userId: "usr_front" }]);

    const result = await service.listBranchMembers("org_1", "br_1");

    expect(result).toHaveLength(2);
    expect(result.find((m) => m.userId === "usr_admin")?.implicitAccess).toBe(true);
    expect(result.find((m) => m.userId === "usr_front")?.hasBranchAccess).toBe(true);
  });

  it("listBranchMembers throws when branch is not in organization", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue(null);

    await expect(service.listBranchMembers("org_1", "br_missing")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("grantBranchAccess upserts ACTIVE user branch row", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: "br_1", organizationId: "org_1" });
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      userId: "usr_front",
      organizationId: "org_1",
      role: "FRONT_DESK",
    });
    mockPrisma.userBranch.upsert.mockResolvedValue({
      id: "ubr_1",
      userId: "usr_front",
      branchId: "br_1",
      status: "ACTIVE",
      user: { id: "usr_front", email: "front@test.com", name: null },
    });

    await service.grantBranchAccess("org_1", "br_1", "usr_front", "usr_admin");

    expect(mockPrisma.userBranch.upsert).toHaveBeenCalled();
  });

  it("userHasBranchAccess returns true for admin without grant row", async () => {
    await expect(
      service.userHasBranchAccess("usr_admin", "org_1", "ADMIN", "br_1"),
    ).resolves.toBe(true);
    expect(mockPrisma.userBranch.findUnique).not.toHaveBeenCalled();
  });

  it("userHasBranchAccess returns false when grant row is missing", async () => {
    mockPrisma.userBranch.findUnique.mockResolvedValue(null);

    await expect(
      service.userHasBranchAccess("usr_front", "org_1", "FRONT_DESK", "br_1"),
    ).resolves.toBe(false);
  });

  it("userHasBranchAccess returns false when grant is inactive", async () => {
    mockPrisma.userBranch.findUnique.mockResolvedValue({
      userId: "usr_front",
      branchId: "br_1",
      organizationId: "org_1",
      status: "REVOKED",
    });

    await expect(
      service.userHasBranchAccess("usr_front", "org_1", "FRONT_DESK", "br_1"),
    ).resolves.toBe(false);
  });

  it("revokeBranchAccess deletes grant for non-admin member", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: "br_1", organizationId: "org_1" });
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      userId: "usr_front",
      organizationId: "org_1",
      role: "FRONT_DESK",
    });
    mockPrisma.userBranch.findUnique.mockResolvedValue({
      id: "ubr_1",
      userId: "usr_front",
      branchId: "br_1",
    });

    await service.revokeBranchAccess("org_1", "br_1", "usr_front", "usr_admin");

    expect(mockPrisma.userBranch.delete).toHaveBeenCalledWith({ where: { id: "ubr_1" } });
  });

  it("revokeBranchAccess throws when grant not found", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: "br_1", organizationId: "org_1" });
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      userId: "usr_front",
      organizationId: "org_1",
      role: "FRONT_DESK",
    });
    mockPrisma.userBranch.findUnique.mockResolvedValue(null);

    await expect(
      service.revokeBranchAccess("org_1", "br_1", "usr_front", "usr_admin"),
    ).rejects.toThrow(NotFoundException);
  });

  it("revokeBranchAccess rejects implicit admin access", async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ id: "br_1", organizationId: "org_1" });
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      userId: "usr_admin",
      organizationId: "org_1",
      role: "ADMIN",
    });

    await expect(
      service.revokeBranchAccess("org_1", "br_1", "usr_admin", "usr_owner"),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrisma.userBranch.delete).not.toHaveBeenCalled();
  });

});

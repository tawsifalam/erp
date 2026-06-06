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

const mockPropelAuth = {
  createOrg: jest.fn(),
  fetchOrg: jest.fn(),
  addUserToOrg: jest.fn(),
  updateOrg: jest.fn(),
  inviteUserToOrg: jest.fn(),
  revokePendingOrgInvite: jest.fn(),
  fetchAllUsersInOrg: jest.fn(),
  removeUserFromOrg: jest.fn(),
  mapPropelAuthRoleToErp: jest.fn((role: string) => {
    const normalized = role.toLowerCase();
    if (normalized === "owner") return "OWNER";
    if (normalized === "admin") return "ADMIN";
    return "FRONT_DESK";
  }),
  mapErpRoleToPropelAuth: jest.fn((role: string) => {
    if (role === "OWNER") return "Owner";
    if (role === "ADMIN") return "Admin";
    return "Member";
  }),
};

describe("TenantsService", () => {
  let service: TenantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    const mockAudit = { record: jest.fn().mockResolvedValue(undefined) };
    mockPropelAuth.fetchOrg.mockResolvedValue({ orgId: "pa_org" });
    mockPropelAuth.createOrg.mockResolvedValue({ orgId: "pa_org_new" });
    mockPropelAuth.addUserToOrg.mockResolvedValue(true);
    mockPropelAuth.updateOrg.mockResolvedValue(true);
    mockPropelAuth.inviteUserToOrg.mockResolvedValue(true);
    service = new TenantsService(
      mockPrisma as never,
      mockInventoryPools as never,
      mockAudit as never,
      mockPropelAuth as never,
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

  it("updateOrganization syncs name to PropelAuth when linked", async () => {
    mockPrisma.organization.update.mockResolvedValue({
      id: "org_1",
      name: "Renamed Hotel",
      propelAuthOrgId: "pa_org_1",
      branches: [],
    });

    const result = await service.updateOrganization("org_1", { name: "Renamed Hotel" }, "usr_1");

    expect(result.name).toBe("Renamed Hotel");
    expect(mockPropelAuth.updateOrg).toHaveBeenCalledWith("pa_org_1", "Renamed Hotel");
  });

  it("updateOrganization skips PropelAuth sync for synthetic org ids", async () => {
    mockPrisma.organization.update.mockResolvedValue({
      id: "org_1",
      name: "Renamed Hotel",
      propelAuthOrgId: "erp_local_org",
      branches: [],
    });

    await service.updateOrganization("org_1", { name: "Renamed Hotel" });

    expect(mockPropelAuth.updateOrg).not.toHaveBeenCalled();
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

  it("createOrganization seeds pools, links PropelAuth, and adds creator", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ propelAuthUserId: "pa_creator" });
    mockPropelAuth.fetchOrg.mockResolvedValue(null);
    mockPropelAuth.createOrg.mockResolvedValue({ orgId: "pa_org_new", name: "Test Org" });
    mockPrisma.organization.update.mockResolvedValue({});

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      const tx = {
        organization: {
          create: jest.fn().mockResolvedValue({
            id: "org_new",
            name: "Test Org",
            propelAuthOrgId: "erp_temp_org",
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
    expect(mockPropelAuth.createOrg).toHaveBeenCalledWith("Test Org", "org_new");
    expect(mockPropelAuth.addUserToOrg).toHaveBeenCalledWith("pa_org_new", "pa_creator");
    expect(result.propelAuthSynced).toBe(true);
    expect(result.organization.propelAuthOrgId).toBe("pa_org_new");
  });

  it("createOrganization uses provided propelAuthOrgId and still adds creator", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ propelAuthUserId: "pa_creator" });
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      const tx = {
        organization: {
          create: jest.fn().mockResolvedValue({
            id: "org_new",
            name: "Linked Org",
            propelAuthOrgId: "pa_existing",
            joinCode: "ov_xyz",
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
      name: "Linked Org",
      timezone: "Asia/Dhaka",
      propelAuthOrgId: "pa_existing",
    });

    expect(mockPropelAuth.createOrg).not.toHaveBeenCalled();
    expect(mockPropelAuth.addUserToOrg).toHaveBeenCalledWith("pa_existing", "pa_creator");
    expect(result.propelAuthSynced).toBe(true);
  });

  it("createOrganization completes when PropelAuth sync fails", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ propelAuthUserId: "pa_creator" });
    mockPropelAuth.fetchOrg.mockResolvedValue(null);
    mockPropelAuth.createOrg.mockRejectedValue(new Error("PropelAuth down"));

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      const tx = {
        organization: {
          create: jest.fn().mockResolvedValue({
            id: "org_new",
            name: "Offline Org",
            propelAuthOrgId: "erp_offline",
            joinCode: "ov_off",
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
      name: "Offline Org",
      timezone: "Asia/Dhaka",
    });

    expect(result.organization.id).toBe("org_new");
    expect(result.propelAuthSynced).toBe(false);
    expect(mockPropelAuth.addUserToOrg).not.toHaveBeenCalled();
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
      mockPropelAuth as never,
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

  it("inviteMember sends PropelAuth invite and records pending invite", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org_1",
      name: "Test Org",
      propelAuthOrgId: "pa_org_1",
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

    expect(mockPropelAuth.inviteUserToOrg).toHaveBeenCalledWith(
      "pa_org_1",
      "new@example.com",
      "Member",
    );
    expect(mockPrisma.organizationInvite.create).toHaveBeenCalled();
  });

  it("inviteMember rejects duplicate pending invite", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org_1",
      propelAuthOrgId: "pa_org_1",
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

  it("removeMember deletes non-founder membership and removes from PropelAuth", async () => {
    mockPrisma.userOrganization.findFirst.mockResolvedValue({ userId: "usr_founder" });
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      id: "uo_2",
      userId: "usr_member",
      role: "FRONT_DESK",
    });
    mockPrisma.organization.findUnique.mockResolvedValue({
      propelAuthOrgId: "pa_org_1",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      propelAuthUserId: "pa_user_member",
      email: "member@test.com",
    });
    mockPropelAuth.removeUserFromOrg.mockResolvedValue(true);
    mockPropelAuth.revokePendingOrgInvite.mockResolvedValue(true);
    mockPrisma.userOrganization.delete.mockResolvedValue({});

    const result = await service.removeMember("org_1", "usr_member", "usr_admin");

    expect(result.removed).toBe(true);
    expect(mockPrisma.userOrganization.delete).toHaveBeenCalledWith({ where: { id: "uo_2" } });
    expect(mockPropelAuth.removeUserFromOrg).toHaveBeenCalledWith(
      "pa_org_1",
      "pa_user_member",
    );
    expect(mockPropelAuth.revokePendingOrgInvite).toHaveBeenCalledWith(
      "pa_org_1",
      "member@test.com",
    );
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

  it("syncUserPropelAuthOrgMemberships creates membership for linked PropelAuth org", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org_1",
      propelAuthOrgId: "pa_org_1",
    });
    mockPrisma.userOrganization.findUnique.mockResolvedValue(null);
    mockPrisma.organizationInvite.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn({
        ...mockPrisma,
        userOrganization: { create: jest.fn() },
        organizationInvite: { updateMany: jest.fn() },
        organizationJoinRequest: { updateMany: jest.fn() },
      } as never),
    );

    await service.syncUserPropelAuthOrgMemberships("usr_1", "member@test.com", [
      { orgId: "pa_org_1", role: "Member" },
    ]);

    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { propelAuthOrgId: "pa_org_1" },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("syncPropelAuthOrgUsersToDb upserts users and adds team membership", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org_1",
      propelAuthOrgId: "pa_org_1",
    });
    mockPropelAuth.fetchAllUsersInOrg.mockResolvedValue([
      {
        userId: "pa_user_1",
        email: "member@test.com",
        firstName: "Team",
        lastName: "Member",
        roleInOrg: "Admin",
      },
    ]);
    mockPrisma.user.upsert.mockResolvedValue({
      id: "usr_1",
      email: "member@test.com",
    });
    mockPrisma.organizationInvite.findMany.mockResolvedValue([]);
    mockPrisma.userOrganization.findUnique.mockResolvedValue(null);
    mockPrisma.organizationInvite.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn({
        ...mockPrisma,
        userOrganization: { create: jest.fn() },
        organizationInvite: { updateMany: jest.fn() },
        organizationJoinRequest: { updateMany: jest.fn() },
      } as never),
    );

    const result = await service.syncPropelAuthOrgUsersToDb("pa_org_1");

    expect(result).toEqual({ usersSynced: 1, membershipsAdded: 1 });
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { propelAuthUserId: "pa_user_1" },
        create: expect.objectContaining({ email: "member@test.com", name: "Team Member" }),
      }),
    );
  });

  it("syncPropelAuthOrgUsersToDb skips synthetic erp_ org ids", async () => {
    const result = await service.syncPropelAuthOrgUsersToDb("erp_local_org");
    expect(result).toEqual({ usersSynced: 0, membershipsAdded: 0 });
    expect(mockPropelAuth.fetchAllUsersInOrg).not.toHaveBeenCalled();
  });

  it("syncOrganizationMembersFromPropelAuth throws when org is not linked", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org_1",
      propelAuthOrgId: "erp_local_org",
    });

    await expect(
      service.syncOrganizationMembersFromPropelAuth("org_1", "usr_admin"),
    ).rejects.toThrow(BadRequestException);
  });
});

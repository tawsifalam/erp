import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { TenantsService } from "./tenants.service";

const mockPrisma = {
  user: { findUnique: jest.fn() },
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
  inviteUserToOrg: jest.fn(),
  revokePendingOrgInvite: jest.fn(),
};

describe("TenantsService", () => {
  let service: TenantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    const mockAudit = { record: jest.fn().mockResolvedValue(undefined) };
    mockPropelAuth.fetchOrg.mockResolvedValue({ orgId: "pa_org" });
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

  it("createOrganization seeds default inventory pools", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      const tx = {
        organization: {
          create: jest.fn().mockResolvedValue({ id: "org_new", name: "Test Org" }),
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

    await service.createOrganization("user_1", {
      name: "Test Org",
      timezone: "Asia/Dhaka",
      propelAuthOrgId: "erp_test_org",
    });

    expect(mockInventoryPools.seedDefaultPools).toHaveBeenCalledWith("org_new");
  });

  it("createOrganization rejects missing name or timezone", async () => {
    await expect(
      service.createOrganization("user_1", { name: "", timezone: "Asia/Dhaka" }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createOrganization("user_1", { name: "Test", timezone: "" }),
    ).rejects.toThrow(BadRequestException);
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
});

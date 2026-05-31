import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TenantsService } from "./tenants.service";

const mockPrisma = {
  userOrganization: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
  organization: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  organizationJoinRequest: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  branch: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockInventoryPools = {
  seedDefaultPools: jest.fn().mockResolvedValue(undefined),
};

describe("TenantsService", () => {
  let service: TenantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantsService(mockPrisma as never, mockInventoryPools as never);
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

  it("createBranch rejects empty name", () => {
    expect(() =>
      service.createBranch("org_1", { name: "  ", timezone: "Asia/Dhaka" }),
    ).toThrow(BadRequestException);
  });

  it("createBranch rejects empty timezone", () => {
    expect(() =>
      service.createBranch("org_1", { name: "Annex", timezone: "" }),
    ).toThrow(BadRequestException);
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

  it("updateOrganization rejects empty name", () => {
    expect(() => service.updateOrganization("org_1", { name: "  " })).toThrow(
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
});

import { NotFoundException } from "@nestjs/common";
import { TenantsService } from "./tenants.service";

const mockPrisma = {
  userOrganization: { findMany: jest.fn() },
  organization: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  branch: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe("TenantsService", () => {
  let service: TenantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantsService(mockPrisma as never);
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

  it("createBranch creates with organizationId", async () => {
    mockPrisma.branch.create.mockResolvedValue({
      id: "br_new",
      name: "Annex",
      timezone: "Asia/Dhaka",
    });
    const result = await service.createBranch("org_1", {
      name: "Annex",
      timezone: "Asia/Dhaka",
    });
    expect(result.name).toBe("Annex");
    expect(mockPrisma.branch.create).toHaveBeenCalledWith({
      data: { organizationId: "org_1", name: "Annex", timezone: "Asia/Dhaka" },
    });
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
});

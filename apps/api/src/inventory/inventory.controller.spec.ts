import { ForbiddenException } from "@nestjs/common";
import { Role } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { InventoryController } from "./inventory.controller";

const tenant: TenantContext = {
  organizationId: "org_a",
  branchId: "br_a1",
  userId: "usr_1",
  role: Role.OWNER,
};

describe("InventoryController tenant isolation", () => {
  const inventory = {
    listItemsWithStock: jest.fn(),
    createItem: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
    getCurrentStock: jest.fn(),
    createMovement: jest.fn(),
    listMovements: jest.fn(),
  };
  const recipes = { upsertRecipe: jest.fn(), getRecipe: jest.fn() };
  const pools = { listPools: jest.fn(), createPool: jest.fn(), updatePool: jest.fn() };
  const tenantScope = {
    resolveBranchId: jest.fn(),
    assertBranchInOrganization: jest.fn(),
  };

  let controller: InventoryController;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantScope.resolveBranchId.mockResolvedValue("br_a1");
    controller = new InventoryController(
      inventory as never,
      recipes as never,
      pools as never,
      tenantScope as never,
    );
  });

  it("rejects cross-org branchId override on list items", async () => {
    tenantScope.resolveBranchId.mockRejectedValue(
      new ForbiddenException("Branch does not belong to this organization"),
    );
    await expect(controller.items(tenant, "br_other_org")).rejects.toThrow(ForbiddenException);
    expect(inventory.listItemsWithStock).not.toHaveBeenCalled();
  });

  it("lists items for validated branch", async () => {
    inventory.listItemsWithStock.mockResolvedValue([]);
    await controller.items(tenant, "br_a1");
    expect(tenantScope.resolveBranchId).toHaveBeenCalledWith(tenant, "br_a1");
    expect(inventory.listItemsWithStock).toHaveBeenCalledWith("br_a1", {
      poolId: undefined,
      poolCode: undefined,
    });
  });

  it("scopes recipe reads to organization", async () => {
    recipes.getRecipe.mockResolvedValue({ menuItemId: "mi_1", lines: [] });
    await controller.getRecipe(tenant, "mi_1");
    expect(recipes.getRecipe).toHaveBeenCalledWith("org_a", "mi_1");
  });
});

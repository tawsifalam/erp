import { BadRequestException } from "@nestjs/common";
import { Role, type TenantContext } from "@erp/types";
import { ProcurementController } from "./procurement.controller";

const tenant: TenantContext = {
  organizationId: "org_a",
  branchId: "br_a1",
  userId: "usr_admin",
  role: Role.ADMIN,
};

describe("ProcurementController tenant isolation", () => {
  const procurement = {
    listPurchaseOrders: jest.fn(),
  };
  const tenantScope = {
    resolveBranchId: jest.fn(),
  };

  let controller: ProcurementController;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantScope.resolveBranchId.mockResolvedValue("br_a1");
    controller = new ProcurementController(procurement as never, tenantScope as never);
  });

  it("listPurchaseOrders resolves branch via TenantScopeService", async () => {
    procurement.listPurchaseOrders.mockResolvedValue([]);
    await controller.listPurchaseOrders(tenant);
    expect(tenantScope.resolveBranchId).toHaveBeenCalledWith(tenant);
    expect(procurement.listPurchaseOrders).toHaveBeenCalledWith("br_a1");
  });

  it("listPurchaseOrders rejects when branchId is missing", async () => {
    tenantScope.resolveBranchId.mockRejectedValue(
      new BadRequestException("branchId is required"),
    );
    await expect(
      controller.listPurchaseOrders({ ...tenant, branchId: undefined }),
    ).rejects.toThrow(BadRequestException);
  });
});

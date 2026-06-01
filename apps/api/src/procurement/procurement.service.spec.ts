import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { MovementType } from "@erp/types";
import { ProcurementService } from "./procurement.service";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { AccountingListenersService } from "../accounting/accounting-listeners.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PO_STATUS_DRAFT, PO_STATUS_SUBMITTED } from "./procurement.constants";

jest.mock("@erp/utils", () => ({
  generatePrefixedId: (prefix: string) => `${prefix}_test`,
  roundMoney: (v: number) => Math.round(v * 100) / 100,
  toNumber: (v: unknown) => Number(v),
}));

const mockPrisma = {
  vendor: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  purchaseOrder: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  purchaseOrderLine: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  goodsReceipt: { create: jest.fn() },
};

const mockInventory = {
  getItem: jest.fn(),
  createMovement: jest.fn(),
};

const mockAccounting = {
  postGoodsReceipt: jest.fn(),
};

const mockAudit = { record: jest.fn() };
const mockNotifications = { notifyOrganizationRoles: jest.fn() };

describe("ProcurementService", () => {
  let service: ProcurementService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventory },
        { provide: AccountingListenersService, useValue: mockAccounting },
        { provide: AuditService, useValue: mockAudit },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get(ProcurementService);
  });

  it("createVendor requires a name", async () => {
    await expect(service.createVendor("org-1", { name: "  " })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("submitPurchaseOrder rejects non-draft PO", async () => {
    mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
      id: "po-1",
      status: PO_STATUS_SUBMITTED,
      vendorId: "ven-1",
      lines: [],
      receipts: [],
      vendor: { id: "ven-1", name: "Vendor" },
    });
    await expect(
      service.submitPurchaseOrder("br-1", "po-1", "org-1"),
    ).rejects.toThrow(/draft/i);
  });

  it("receiveGoods creates movement and posts accounting", async () => {
    mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
      id: "po-1",
      status: PO_STATUS_SUBMITTED,
      vendorId: "ven-1",
      lines: [
        {
          id: "pol-1",
          quantity: 10,
          unitPrice: 50,
          receivedQty: 0,
          inventoryItemId: "inv-1",
          inventoryItem: { id: "inv-1" },
        },
      ],
      receipts: [],
      vendor: { id: "ven-1", name: "Vendor" },
    });
    mockInventory.createMovement.mockResolvedValue({ id: "mov-1" });
    mockPrisma.goodsReceipt.create.mockResolvedValue({ id: "gr-1" });
    mockPrisma.purchaseOrderLine.findMany.mockResolvedValue([
      { id: "pol-1", quantity: 10, receivedQty: 10 },
    ]);

    await service.receiveGoods({
      organizationId: "org-1",
      branchId: "br-1",
      purchaseOrderId: "po-1",
      purchaseOrderLineId: "pol-1",
      quantity: 10,
      userId: "user-1",
    });

    expect(mockInventory.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        movementType: MovementType.PURCHASE,
        quantity: 10,
        unitCost: 50,
      }),
    );
    expect(mockAccounting.postGoodsReceipt).toHaveBeenCalledWith("org-1", "gr-1", 500);
    expect(mockAudit.record).toHaveBeenCalled();
  });
});

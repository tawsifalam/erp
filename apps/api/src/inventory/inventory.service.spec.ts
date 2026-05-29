import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { MovementDirection, MovementType } from "@prisma/client";
import { InventoryService } from "./inventory.service";
import { PrismaService } from "../prisma/prisma.service";

jest.mock("@erp/utils", () => ({
  toNumber: (v: unknown) => Number(v),
}));

const mockPrisma = {
  inventoryItem: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  inventoryMovement: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

describe("InventoryService", () => {
  let service: InventoryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe("getCurrentStock", () => {
    it("returns sum(IN) - sum(OUT) from movements", async () => {
      mockPrisma.inventoryMovement.findMany.mockResolvedValue([
        { quantity: 100, direction: MovementDirection.IN },
        { quantity: 30, direction: MovementDirection.OUT },
        { quantity: 20, direction: MovementDirection.IN },
        { quantity: 10, direction: MovementDirection.OUT },
      ]);

      const stock = await service.getCurrentStock("item-1", "branch-1");

      expect(stock).toBe(80); // (100 + 20) - (30 + 10)
      expect(mockPrisma.inventoryMovement.findMany).toHaveBeenCalledWith({
        where: { itemId: "item-1", branchId: "branch-1" },
      });
    });

    it("returns 0 when there are no movements", async () => {
      mockPrisma.inventoryMovement.findMany.mockResolvedValue([]);

      const stock = await service.getCurrentStock("item-1", "branch-1");

      expect(stock).toBe(0);
    });

    it("handles all-IN movements", async () => {
      mockPrisma.inventoryMovement.findMany.mockResolvedValue([
        { quantity: 50, direction: MovementDirection.IN },
        { quantity: 25, direction: MovementDirection.IN },
      ]);

      const stock = await service.getCurrentStock("item-1", "branch-1");

      expect(stock).toBe(75);
    });

    it("can produce negative stock", async () => {
      mockPrisma.inventoryMovement.findMany.mockResolvedValue([
        { quantity: 10, direction: MovementDirection.IN },
        { quantity: 50, direction: MovementDirection.OUT },
      ]);

      const stock = await service.getCurrentStock("item-1", "branch-1");

      expect(stock).toBe(-40);
    });
  });

  describe("createMovement", () => {
    it("throws BadRequestException when quantity <= 0", () => {
      expect(() =>
        service.createMovement({
          itemId: "item-1",
          branchId: "branch-1",
          movementType: MovementType.PURCHASE,
          quantity: 0,
        }),
      ).toThrow(BadRequestException);
    });

    it("throws BadRequestException when quantity is negative", () => {
      expect(() =>
        service.createMovement({
          itemId: "item-1",
          branchId: "branch-1",
          movementType: MovementType.PURCHASE,
          quantity: -5,
        }),
      ).toThrow(BadRequestException);
    });

    it("assigns direction IN for PURCHASE", async () => {
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      await service.createMovement({
        itemId: "item-1",
        branchId: "branch-1",
        movementType: MovementType.PURCHASE,
        quantity: 10,
      });

      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: MovementDirection.IN,
          movementType: MovementType.PURCHASE,
        }),
      });
    });

    it("assigns direction OUT for SALE", async () => {
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      await service.createMovement({
        itemId: "item-1",
        branchId: "branch-1",
        movementType: MovementType.SALE,
        quantity: 5,
      });

      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: MovementDirection.OUT,
        }),
      });
    });

    it("assigns direction OUT for WASTE", async () => {
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      await service.createMovement({
        itemId: "item-1",
        branchId: "branch-1",
        movementType: MovementType.WASTE,
        quantity: 3,
      });

      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: MovementDirection.OUT,
        }),
      });
    });

    it("assigns direction OUT for STAFF_MEAL", async () => {
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      await service.createMovement({
        itemId: "item-1",
        branchId: "branch-1",
        movementType: MovementType.STAFF_MEAL,
        quantity: 2,
      });

      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: MovementDirection.OUT,
        }),
      });
    });

    it("assigns direction IN for ADJUSTMENT with positive quantity", async () => {
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      await service.createMovement({
        itemId: "item-1",
        branchId: "branch-1",
        movementType: MovementType.ADJUSTMENT,
        quantity: 5,
      });

      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: MovementDirection.IN,
          movementType: MovementType.ADJUSTMENT,
        }),
      });
    });

    it("passes all fields to prisma create", async () => {
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      await service.createMovement({
        itemId: "item-1",
        branchId: "branch-1",
        movementType: MovementType.PURCHASE,
        quantity: 10,
        referenceType: "PurchaseOrder",
        referenceId: "po-1",
        notes: "test note",
      });

      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
        data: {
          itemId: "item-1",
          branchId: "branch-1",
          movementType: MovementType.PURCHASE,
          direction: MovementDirection.IN,
          quantity: 10,
          referenceType: "PurchaseOrder",
          referenceId: "po-1",
          notes: "test note",
        },
      });
    });
  });

  describe("listItems", () => {
    it("queries items by branchId", async () => {
      const items = [{ id: "i1", name: "Rice" }];
      mockPrisma.inventoryItem.findMany.mockResolvedValue(items);

      const result = await service.listItems("branch-1");

      expect(result).toEqual(items);
      expect(mockPrisma.inventoryItem.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
      });
    });
  });

  describe("listItemsWithStock", () => {
    it("returns items with computed stock", async () => {
      mockPrisma.inventoryItem.findMany.mockResolvedValue([
        { id: "item-1", name: "Rice" },
        { id: "item-2", name: "Oil" },
      ]);

      mockPrisma.inventoryMovement.findMany
        .mockResolvedValueOnce([
          { quantity: 100, direction: MovementDirection.IN },
          { quantity: 30, direction: MovementDirection.OUT },
        ])
        .mockResolvedValueOnce([
          { quantity: 50, direction: MovementDirection.IN },
        ]);

      const result = await service.listItemsWithStock("branch-1");

      expect(result).toEqual([
        { id: "item-1", name: "Rice", currentStock: 70 },
        { id: "item-2", name: "Oil", currentStock: 50 },
      ]);
    });

    it("returns empty array when no items exist", async () => {
      mockPrisma.inventoryItem.findMany.mockResolvedValue([]);

      const result = await service.listItemsWithStock("branch-1");

      expect(result).toEqual([]);
    });
  });
});

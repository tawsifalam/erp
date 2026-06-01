import { Test, TestingModule } from "@nestjs/testing";
import { MovementType } from "@erp/types";
import { InventoryRecipesService } from "./inventory-recipes.service";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "./inventory.service";

jest.mock("@erp/utils", () => ({
  toNumber: (v: unknown) => Number(v),
  generatePrefixedId: () => "rl_test",
}));

const mockPrisma = {
  recipe: { upsert: jest.fn(), findUnique: jest.fn() },
  order: { findUnique: jest.fn() },
  menuItem: { findUnique: jest.fn() },
};

const mockInventory = {
  createMovement: jest.fn(),
  assertItemInPool: jest.fn().mockResolvedValue({ id: "inv-1" }),
};

describe("InventoryRecipesService", () => {
  let service: InventoryRecipesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryRecipesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventory },
      ],
    }).compile();
    service = module.get(InventoryRecipesService);
  });

  it("upsertRecipe replaces lines", async () => {
    mockPrisma.menuItem.findUnique.mockResolvedValue({
      id: "mi-1",
      category: { branchId: "br-1" },
    });
    mockPrisma.recipe.upsert.mockResolvedValue({ menuItemId: "mi-1", lines: [] });

    await service.upsertRecipe("mi-1", [
      { inventoryItemId: "inv-1", quantity: 0.5 },
    ]);

    expect(mockInventory.assertItemInPool).toHaveBeenCalledWith("br-1", "inv-1", "guest");
    expect(mockPrisma.recipe.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { menuItemId: "mi-1" },
      }),
    );
  });

  it("deductForOrder creates SALE movements and returns cogs estimate", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "ord-1",
      lines: [
        {
          quantity: 2,
          menuItem: {
            recipe: {
              lines: [
                {
                  inventoryItemId: "inv-rice",
                  quantity: 0.3,
                  inventoryItem: { averageUnitCost: 5 },
                },
              ],
            },
          },
        },
      ],
    });

    const cogs = await service.deductForOrder("ord-1", "br-1");

    expect(mockInventory.createMovement).toHaveBeenCalledWith({
      itemId: "inv-rice",
      branchId: "br-1",
      movementType: MovementType.SALE,
      quantity: 0.6,
      referenceType: "Order",
      referenceId: "ord-1",
    });
    expect(cogs).toBe(3);
  });

  it("deductForOrder returns 0 when order missing", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);
    expect(await service.deductForOrder("ord-x", "br-1")).toBe(0);
  });
});

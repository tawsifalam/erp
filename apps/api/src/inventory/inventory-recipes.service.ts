import { BadRequestException, Injectable } from "@nestjs/common";
import { MovementType } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "./inventory.service";
import { toNumber, generatePrefixedId } from "@erp/utils";
import { POOL_CODE_GUEST } from "./inventory.constants";

@Injectable()
export class InventoryRecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async upsertRecipe(
    menuItemId: string,
    lines: { inventoryItemId: string; quantity: number }[],
  ) {
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: { category: true },
    });
    if (!menuItem) throw new BadRequestException("Menu item not found");

    const branchId = menuItem.category.branchId;
    const validLines = lines.filter((l) => l.inventoryItemId && l.quantity > 0);
    for (const line of validLines) {
      await this.inventory.assertItemInPool(
        branchId,
        line.inventoryItemId,
        POOL_CODE_GUEST,
      );
    }

    return this.prisma.recipe.upsert({
      where: { menuItemId },
      update: {
        lines: {
          deleteMany: {},
          create: validLines.map((l) => ({
            id: generatePrefixedId("rl"),
            inventoryItemId: l.inventoryItemId,
            quantity: l.quantity,
          })),
        },
      },
      create: {
        menuItemId,
        lines: {
          create: validLines.map((l) => ({
            id: generatePrefixedId("rl"),
            inventoryItemId: l.inventoryItemId,
            quantity: l.quantity,
          })),
        },
      },
      include: { lines: true },
    });
  }

  getRecipe(menuItemId: string) {
    return this.prisma.recipe.findUnique({
      where: { menuItemId },
      include: {
        lines: {
          include: {
            inventoryItem: { include: { pool: { select: { code: true, name: true } } } },
          },
        },
      },
    });
  }

  /** Deduct inventory for completed order; returns estimated COGS */
  async deductForOrder(orderId: string, branchId: string): Promise<number> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        lines: {
          include: {
            menuItem: {
              include: {
                recipe: {
                  include: {
                    lines: { include: { inventoryItem: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!order) return 0;

    let cogs = 0;

    for (const line of order.lines) {
      const recipe = line.menuItem.recipe;
      if (!recipe) continue;

      for (const recipeLine of recipe.lines) {
        const qty = toNumber(recipeLine.quantity) * line.quantity;
        await this.inventory.createMovement({
          itemId: recipeLine.inventoryItemId,
          branchId,
          movementType: MovementType.SALE,
          quantity: qty,
          referenceType: "Order",
          referenceId: orderId,
        });
        cogs += qty * toNumber(recipeLine.inventoryItem.averageUnitCost);
      }
    }

    return cogs;
  }
}

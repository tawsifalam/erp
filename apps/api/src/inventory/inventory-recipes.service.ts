import { Injectable } from "@nestjs/common";
import { MovementType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "./inventory.service";
import { toNumber, generatePrefixedId } from "@erp/utils";

@Injectable()
export class InventoryRecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  upsertRecipe(menuItemId: string, lines: { inventoryItemId: string; quantity: number }[]) {
    return this.prisma.recipe.upsert({
      where: { menuItemId },
      update: {
        lines: {
          deleteMany: {},
          create: lines.map((l) => ({
            id: generatePrefixedId("rl"),
            inventoryItemId: l.inventoryItemId,
            quantity: l.quantity,
          })),
        },
      },
      create: {
        menuItemId,
        lines: {
          create: lines.map((l) => ({
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
      include: { lines: { include: { inventoryItem: true } } },
    });
  }

  /** Deduct inventory for completed order; returns estimated COGS */
  async deductForOrder(orderId: string, branchId: string): Promise<number> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { lines: { include: { menuItem: { include: { recipe: { include: { lines: true } } } } } } },
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
        cogs += qty * 1;
      }
    }

    return cogs;
  }
}

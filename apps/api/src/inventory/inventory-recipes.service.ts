import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
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
    organizationId: string,
    menuItemId: string,
    lines: { inventoryItemId: string; quantity: number }[],
  ) {
    const menuItem = await this.getMenuItemForOrg(organizationId, menuItemId);
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

  async getRecipe(organizationId: string, menuItemId: string) {
    await this.getMenuItemForOrg(organizationId, menuItemId);
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

  private async getMenuItemForOrg(organizationId: string, menuItemId: string) {
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: { category: true },
    });
    if (!menuItem) throw new NotFoundException("Menu item not found");
    if (menuItem.category.organizationId !== organizationId) {
      throw new ForbiddenException("Menu item does not belong to this organization");
    }
    return menuItem;
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

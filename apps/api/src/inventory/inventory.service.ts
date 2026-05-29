import { BadRequestException, Injectable } from "@nestjs/common";
import { MovementDirection, MovementType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { toNumber } from "@erp/utils";

const IN_TYPES: MovementType[] = [MovementType.PURCHASE, MovementType.ADJUSTMENT];
const OUT_TYPES: MovementType[] = [
  MovementType.SALE,
  MovementType.WASTE,
  MovementType.STAFF_MEAL,
  MovementType.ADJUSTMENT,
];

function directionFor(type: MovementType, quantity: number): MovementDirection {
  if (type === MovementType.PURCHASE) return MovementDirection.IN;
  if (
    type === MovementType.SALE ||
    type === MovementType.WASTE ||
    type === MovementType.STAFF_MEAL
  ) {
    return MovementDirection.OUT;
  }
  return quantity >= 0 ? MovementDirection.IN : MovementDirection.OUT;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  listItems(branchId: string) {
    return this.prisma.inventoryItem.findMany({ where: { branchId } });
  }

  createItem(
    branchId: string,
    data: { name: string; sku: string; unit: string; lowStockThreshold?: number },
  ) {
    return this.prisma.inventoryItem.create({ data: { branchId, ...data } });
  }

  async getCurrentStock(itemId: string, branchId: string): Promise<number> {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: { itemId, branchId },
    });

    let stock = 0;
    for (const m of movements) {
      const q = toNumber(m.quantity);
      stock += m.direction === MovementDirection.IN ? q : -q;
    }
    return stock;
  }

  async listItemsWithStock(branchId: string) {
    const items = await this.listItems(branchId);
    return Promise.all(
      items.map(async (item) => ({
        ...item,
        currentStock: await this.getCurrentStock(item.id, branchId),
      })),
    );
  }

  createMovement(params: {
    itemId: string;
    branchId: string;
    movementType: MovementType;
    quantity: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
  }) {
    if (params.quantity <= 0) {
      throw new BadRequestException("quantity must be positive");
    }

    const direction = directionFor(params.movementType, params.quantity);

    return this.prisma.inventoryMovement.create({
      data: {
        itemId: params.itemId,
        branchId: params.branchId,
        movementType: params.movementType,
        direction,
        quantity: params.quantity,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        notes: params.notes,
      },
    });
  }

  listMovements(itemId: string, branchId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { itemId, branchId },
      orderBy: { createdAt: "desc" },
    });
  }
}

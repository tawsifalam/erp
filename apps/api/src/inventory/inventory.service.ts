import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MovementDirection, MovementType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { toNumber } from "@erp/utils";

function directionFor(
  type: MovementType,
  quantity: number,
  adjustmentDirection?: MovementDirection,
): MovementDirection {
  if (type === MovementType.PURCHASE) return MovementDirection.IN;
  if (
    type === MovementType.SALE ||
    type === MovementType.WASTE ||
    type === MovementType.STAFF_MEAL
  ) {
    return MovementDirection.OUT;
  }
  if (type === MovementType.ADJUSTMENT) {
    return adjustmentDirection ?? MovementDirection.IN;
  }
  return quantity >= 0 ? MovementDirection.IN : MovementDirection.OUT;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  listItems(branchId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { branchId },
      orderBy: { name: "asc" },
    });
  }

  async getItem(branchId: string, itemId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, branchId },
    });
    if (!item) throw new NotFoundException("Inventory item not found");
    return item;
  }

  createItem(
    branchId: string,
    data: { name: string; sku: string; unit: string; lowStockThreshold?: number },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("Item name is required");
    if (!data.sku?.trim()) throw new BadRequestException("SKU is required");
    if (!data.unit?.trim()) throw new BadRequestException("Unit is required");
    if (data.lowStockThreshold != null && data.lowStockThreshold < 0) {
      throw new BadRequestException("lowStockThreshold cannot be negative");
    }

    return this.prisma.inventoryItem.create({
      data: {
        branchId,
        name: data.name.trim(),
        sku: data.sku.trim(),
        unit: data.unit.trim(),
        lowStockThreshold: data.lowStockThreshold,
      },
    });
  }

  async updateItem(
    branchId: string,
    itemId: string,
    data: { name?: string; unit?: string; lowStockThreshold?: number | null },
  ) {
    await this.getItem(branchId, itemId);
    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException("Item name is required");
    }
    if (data.unit !== undefined && !data.unit.trim()) {
      throw new BadRequestException("Unit is required");
    }
    if (data.lowStockThreshold != null && data.lowStockThreshold < 0) {
      throw new BadRequestException("lowStockThreshold cannot be negative");
    }

    return this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.unit !== undefined ? { unit: data.unit.trim() } : {}),
        ...(data.lowStockThreshold !== undefined
          ? { lowStockThreshold: data.lowStockThreshold }
          : {}),
      },
    });
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
    direction?: MovementDirection;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
  }) {
    if (params.quantity <= 0) {
      throw new BadRequestException("quantity must be positive");
    }

    if (
      params.movementType === MovementType.ADJUSTMENT &&
      params.direction &&
      params.direction !== MovementDirection.IN &&
      params.direction !== MovementDirection.OUT
    ) {
      throw new BadRequestException("direction must be IN or OUT for ADJUSTMENT");
    }

    const direction = directionFor(
      params.movementType,
      params.quantity,
      params.direction,
    );

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

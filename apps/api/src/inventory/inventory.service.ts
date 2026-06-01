import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MovementDirection, MovementType } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { AuditAction, AuditEntityType } from "../audit/audit.constants";
import { AuditService } from "../audit/audit.service";
import { roundMoney, toNumber } from "@erp/utils";
import { InventoryPoolsService } from "./inventory-pools.service";

function directionFor(
  type: MovementType,
  quantity: number,
  adjustmentDirection?: MovementDirection,
): MovementDirection {
  if (type === MovementType.PURCHASE) return MovementDirection.IN;
  if (
    type === MovementType.SALE ||
    type === MovementType.WASTE ||
    type === MovementType.STAFF_MEAL ||
    type === MovementType.GUEST_INCLUSION
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly pools: InventoryPoolsService,
    private readonly audit: AuditService,
  ) {}

  private async branchOrganizationId(branchId: string): Promise<string> {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch.organizationId;
  }

  listItems(
    branchId: string,
    filter?: { poolId?: string; poolCode?: string },
  ) {
    const poolWhere = filter?.poolId
      ? { poolId: filter.poolId }
      : filter?.poolCode
        ? { pool: { code: filter.poolCode } }
        : {};

    return this.prisma.inventoryItem.findMany({
      where: { branchId, ...poolWhere },
      include: { pool: { select: { id: true, code: true, name: true } } },
      orderBy: { name: "asc" },
    });
  }

  async getItem(branchId: string, itemId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, branchId },
      include: { pool: { select: { id: true, code: true, name: true } } },
    });
    if (!item) throw new NotFoundException("Inventory item not found");
    return item;
  }

  async assertItemInPool(branchId: string, itemId: string, poolCode: string) {
    const item = await this.getItem(branchId, itemId);
    if (item.pool.code !== poolCode) {
      throw new BadRequestException(
        `Item must belong to the "${poolCode}" inventory pool`,
      );
    }
    return item;
  }

  async createItem(
    branchId: string,
    data: {
      name: string;
      sku: string;
      unit: string;
      lowStockThreshold?: number;
      poolId?: string;
    },
    userId?: string,
  ) {
    if (!data.name?.trim()) throw new BadRequestException("Item name is required");
    if (!data.sku?.trim()) throw new BadRequestException("SKU is required");
    if (!data.unit?.trim()) throw new BadRequestException("Unit is required");
    if (data.lowStockThreshold != null && data.lowStockThreshold < 0) {
      throw new BadRequestException("lowStockThreshold cannot be negative");
    }

    const organizationId = await this.branchOrganizationId(branchId);
    const poolId =
      data.poolId ?? (await this.pools.defaultGuestPoolId(organizationId));
    await this.pools.getPool(organizationId, poolId);

    const item = await this.prisma.inventoryItem.create({
      data: {
        branchId,
        poolId,
        name: data.name.trim(),
        sku: data.sku.trim(),
        unit: data.unit.trim(),
        lowStockThreshold: data.lowStockThreshold,
      },
      include: { pool: { select: { id: true, code: true, name: true } } },
    });

    await this.audit.record({
      organizationId,
      userId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.INVENTORY_ITEM,
      entityId: item.id,
      metadata: { name: item.name, sku: item.sku },
    });

    return item;
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
      include: { pool: { select: { id: true, code: true, name: true } } },
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

  async getAverageUnitCost(itemId: string, branchId: string): Promise<number> {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, branchId },
      select: { averageUnitCost: true },
    });
    if (!item) throw new NotFoundException("Inventory item not found");
    return toNumber(item.averageUnitCost);
  }

  async listItemsWithStock(
    branchId: string,
    filter?: { poolId?: string; poolCode?: string },
  ) {
    const items = await this.listItems(branchId, filter);
    return Promise.all(
      items.map(async (item) => ({
        ...item,
        currentStock: await this.getCurrentStock(item.id, branchId),
      })),
    );
  }

  async createMovement(params: {
    itemId: string;
    branchId: string;
    movementType: MovementType;
    quantity: number;
    direction?: MovementDirection;
    unitCost?: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
    userId?: string;
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

    if (params.unitCost != null && params.unitCost < 0) {
      throw new BadRequestException("unitCost cannot be negative");
    }

    const direction = directionFor(
      params.movementType,
      params.quantity,
      params.direction,
    );

    if (
      direction === MovementDirection.IN &&
      params.unitCost != null &&
      params.unitCost >= 0
    ) {
      const stock = await this.getCurrentStock(params.itemId, params.branchId);
      const item = await this.getItem(params.branchId, params.itemId);
      const oldAvg = toNumber(item.averageUnitCost);
      const newAvg =
        stock <= 0
          ? params.unitCost
          : roundMoney(
              (stock * oldAvg + params.quantity * params.unitCost) /
                (stock + params.quantity),
            );
      await this.prisma.inventoryItem.update({
        where: { id: params.itemId },
        data: { averageUnitCost: newAvg },
      });
    }

    const unitCost =
      direction === MovementDirection.IN && params.unitCost != null
        ? params.unitCost
        : undefined;

    const organizationId = await this.branchOrganizationId(params.branchId);
    const movement = await this.prisma.inventoryMovement.create({
      data: {
        itemId: params.itemId,
        branchId: params.branchId,
        movementType: params.movementType,
        direction,
        quantity: params.quantity,
        unitCost,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        notes: params.notes,
      },
    });

    await this.audit.record({
      organizationId,
      userId: params.userId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.INVENTORY_MOVEMENT,
      entityId: movement.id,
      metadata: {
        itemId: params.itemId,
        movementType: params.movementType,
        quantity: params.quantity,
      },
    });

    return movement;
  }

  listMovements(itemId: string, branchId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { itemId, branchId },
      orderBy: { createdAt: "desc" },
    });
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  DEFAULT_INVENTORY_POOLS,
  isValidPoolCode,
  normalizePoolCode,
  POOL_CODE_GUEST,
} from "./inventory.constants";

@Injectable()
export class InventoryPoolsService {
  constructor(private readonly prisma: PrismaService) {}

  async seedDefaultPools(organizationId: string) {
    for (const pool of DEFAULT_INVENTORY_POOLS) {
      await this.prisma.inventoryPool.upsert({
        where: {
          organizationId_code: { organizationId, code: pool.code },
        },
        update: {},
        create: {
          organizationId,
          code: pool.code,
          name: pool.name,
          isSystem: pool.isSystem,
          sortOrder: pool.sortOrder,
        },
      });
    }
  }

  async listPools(organizationId: string, activeOnly = false) {
    await this.seedDefaultPools(organizationId);
    return this.prisma.inventoryPool.findMany({
      where: {
        organizationId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async getPool(organizationId: string, poolId: string) {
    const pool = await this.prisma.inventoryPool.findFirst({
      where: { id: poolId, organizationId },
    });
    if (!pool) throw new NotFoundException("Inventory pool not found");
    return pool;
  }

  async getPoolByCode(organizationId: string, code: string) {
    await this.seedDefaultPools(organizationId);
    const pool = await this.prisma.inventoryPool.findFirst({
      where: { organizationId, code: normalizePoolCode(code) },
    });
    if (!pool) throw new NotFoundException(`Inventory pool "${code}" not found`);
    return pool;
  }

  async createPool(
    organizationId: string,
    data: { code: string; name: string; sortOrder?: number },
  ) {
    const code = normalizePoolCode(data.code);
    if (!isValidPoolCode(code)) {
      throw new BadRequestException(
        "Pool code must be lowercase letters, numbers, and hyphens (e.g. minibar)",
      );
    }
    if (!data.name?.trim()) throw new BadRequestException("Pool name is required");
    if (DEFAULT_INVENTORY_POOLS.some((p) => p.code === code)) {
      throw new BadRequestException("This pool code is reserved");
    }

    const maxSort = await this.prisma.inventoryPool.aggregate({
      where: { organizationId },
      _max: { sortOrder: true },
    });

    return this.prisma.inventoryPool.create({
      data: {
        organizationId,
        code,
        name: data.name.trim(),
        sortOrder: data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async updatePool(
    organizationId: string,
    poolId: string,
    data: { name?: string; isActive?: boolean; sortOrder?: number },
  ) {
    const pool = await this.getPool(organizationId, poolId);

    if (data.isActive === false && pool.isSystem) {
      throw new BadRequestException("System pools cannot be deactivated");
    }

    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException("Pool name is required");
    }

    return this.prisma.inventoryPool.update({
      where: { id: poolId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
    });
  }

  async resolvePoolFilter(
    organizationId: string,
    poolId?: string,
    poolCode?: string,
  ) {
    if (poolId) return this.getPool(organizationId, poolId);
    if (poolCode) return this.getPoolByCode(organizationId, poolCode);
    return null;
  }

  async defaultGuestPoolId(organizationId: string): Promise<string> {
    const pool = await this.getPoolByCode(organizationId, POOL_CODE_GUEST);
    return pool.id;
  }
}

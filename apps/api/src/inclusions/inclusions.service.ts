import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InclusionConsumptionSource,
  InclusionType,
  MovementType,
  ReservationStatus,
} from "@erp/types";
import { generatePrefixedId, toNumber } from "@erp/utils";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import {
  POOL_CODE_GUEST,
  POOL_CODE_HOUSEKEEPING,
} from "../inventory/inventory.constants";
import {
  countStayNights,
  unitLabelFor,
} from "./inclusions.constants";

type PackageRuleInput = {
  inclusionType: InclusionType;
  inclusionRecipeId: string;
  quantityPerGuestPerNight?: number | null;
  quantityPerGuestPerStay?: number | null;
  autoIssueOnCheckIn?: boolean;
  sortOrder?: number;
};

@Injectable()
export class InclusionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  listPackages(organizationId: string) {
    return this.prisma.inclusionPackage.findMany({
      where: { organizationId },
      include: {
        rules: {
          include: {
            recipe: { select: { id: true, name: true, inclusionType: true, branchId: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async createPackage(
    organizationId: string,
    data: {
      name: string;
      isDefault?: boolean;
      isActive?: boolean;
      rules?: PackageRuleInput[];
    },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("Package name is required");

    if (data.isDefault) {
      await this.prisma.inclusionPackage.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const rules = data.rules ?? [];
    await this.validatePackageRules(organizationId, rules);

    return this.prisma.inclusionPackage.create({
      data: {
        organizationId,
        name: data.name.trim(),
        isDefault: data.isDefault ?? false,
        isActive: data.isActive ?? true,
        rules: {
          create: rules.map((r, i) => ({
            inclusionType: r.inclusionType,
            inclusionRecipeId: r.inclusionRecipeId,
            quantityPerGuestPerNight: r.quantityPerGuestPerNight ?? null,
            quantityPerGuestPerStay: r.quantityPerGuestPerStay ?? null,
            autoIssueOnCheckIn: r.autoIssueOnCheckIn ?? false,
            sortOrder: r.sortOrder ?? i,
          })),
        },
      },
      include: {
        rules: {
          include: { recipe: { select: { id: true, name: true, inclusionType: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  }

  async updatePackage(
    organizationId: string,
    packageId: string,
    data: {
      name?: string;
      isDefault?: boolean;
      isActive?: boolean;
      rules?: PackageRuleInput[];
    },
  ) {
    const pkg = await this.getPackage(organizationId, packageId);

    if (data.isDefault) {
      await this.prisma.inclusionPackage.updateMany({
        where: { organizationId, isDefault: true, id: { not: packageId } },
        data: { isDefault: false },
      });
    }

    if (data.rules) {
      await this.validatePackageRules(organizationId, data.rules);
    }

    if (data.rules !== undefined) {
      await this.prisma.inclusionPackageRule.deleteMany({ where: { packageId } });
    }

    return this.prisma.inclusionPackage.update({
      where: { id: pkg.id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.rules !== undefined
          ? {
              rules: {
                create: data.rules.map((r, i) => ({
                  inclusionType: r.inclusionType,
                  inclusionRecipeId: r.inclusionRecipeId,
                  quantityPerGuestPerNight: r.quantityPerGuestPerNight ?? null,
                  quantityPerGuestPerStay: r.quantityPerGuestPerStay ?? null,
                  autoIssueOnCheckIn: r.autoIssueOnCheckIn ?? false,
                  sortOrder: r.sortOrder ?? i,
                })),
              },
            }
          : {}),
      },
      include: {
        rules: {
          include: { recipe: { select: { id: true, name: true, inclusionType: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  }

  private async validatePackageRules(organizationId: string, rules: PackageRuleInput[]) {
    for (const rule of rules) {
      const recipe = await this.prisma.inclusionRecipe.findUnique({
        where: { id: rule.inclusionRecipeId },
        include: { branch: { select: { organizationId: true } } },
      });
      if (!recipe || recipe.branch.organizationId !== organizationId) {
        throw new BadRequestException("Inclusion recipe not found in organization");
      }
      if (recipe.inclusionType !== rule.inclusionType) {
        throw new BadRequestException("Recipe inclusion type must match rule type");
      }
      if (rule.inclusionType === InclusionType.MEAL) {
        if (!rule.quantityPerGuestPerNight || rule.quantityPerGuestPerNight <= 0) {
          throw new BadRequestException("Meal rules require quantityPerGuestPerNight > 0");
        }
      }
      if (rule.inclusionType === InclusionType.AMENITY_KIT) {
        if (!rule.quantityPerGuestPerStay || rule.quantityPerGuestPerStay <= 0) {
          throw new BadRequestException("Amenity rules require quantityPerGuestPerStay > 0");
        }
      }
    }
  }

  async getPackage(organizationId: string, packageId: string) {
    const pkg = await this.prisma.inclusionPackage.findFirst({
      where: { id: packageId, organizationId },
    });
    if (!pkg) throw new NotFoundException("Inclusion package not found");
    return pkg;
  }

  listRecipes(branchId: string) {
    return this.prisma.inclusionRecipe.findMany({
      where: { branchId },
      include: {
        lines: {
          include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  async upsertRecipe(
    branchId: string,
    data: {
      id?: string;
      name: string;
      inclusionType: InclusionType;
      lines: { inventoryItemId: string; quantity: number }[];
    },
  ) {
    if (!branchId) throw new BadRequestException("Branch is required");
    if (!data.name?.trim()) throw new BadRequestException("Recipe name is required");

    const poolCode =
      data.inclusionType === InclusionType.MEAL ? POOL_CODE_GUEST : POOL_CODE_HOUSEKEEPING;

    const lines = data.lines.filter((l) => l.inventoryItemId && l.quantity > 0);
    if (lines.length === 0) {
      throw new BadRequestException("At least one recipe line is required");
    }

    for (const line of lines) {
      await this.inventory.assertItemInPool(branchId, line.inventoryItemId, poolCode);
    }

    const lineCreates = lines.map((l) => ({
      id: generatePrefixedId("irl"),
      inventoryItemId: l.inventoryItemId,
      quantity: l.quantity,
    }));

    if (data.id) {
      const existing = await this.prisma.inclusionRecipe.findFirst({
        where: { id: data.id, branchId },
      });
      if (!existing) throw new NotFoundException("Inclusion recipe not found");

      return this.prisma.inclusionRecipe.update({
        where: { id: data.id },
        data: {
          name: data.name.trim(),
          inclusionType: data.inclusionType,
          lines: { deleteMany: {}, create: lineCreates },
        },
        include: {
          lines: {
            include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
          },
        },
      });
    }

    return this.prisma.inclusionRecipe.create({
      data: {
        branchId,
        name: data.name.trim(),
        inclusionType: data.inclusionType,
        lines: { create: lineCreates },
      },
      include: {
        lines: {
          include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
        },
      },
    });
  }

  async getRecipe(branchId: string, recipeId: string) {
    const recipe = await this.prisma.inclusionRecipe.findFirst({
      where: { id: recipeId, branchId },
      include: { lines: true },
    });
    if (!recipe) throw new NotFoundException("Inclusion recipe not found");
    if (recipe.lines.length === 0) {
      throw new BadRequestException("Inclusion recipe has no ingredients");
    }
    return recipe;
  }

  async listAllowances(branchId: string, reservationId: string) {
    await this.assertReservation(branchId, reservationId);
    const rows = await this.prisma.reservationAllowance.findMany({
      where: { reservationId },
      include: { recipe: { select: { name: true } } },
      orderBy: [{ inclusionType: "asc" }, { recipe: { name: "asc" } }],
    });
    return rows.map((a) => ({
      id: a.id,
      inclusionType: a.inclusionType as InclusionType,
      inclusionRecipeId: a.inclusionRecipeId,
      recipeName: a.recipe.name,
      entitledQty: a.entitledQty,
      consumedQty: a.consumedQty,
      remainingQty: Math.max(0, a.entitledQty - a.consumedQty),
      unitLabel: a.unitLabel,
    }));
  }

  async snapshotAllowances(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        package: {
          include: {
            rules: { orderBy: { sortOrder: "asc" } },
          },
        },
        branch: { select: { organizationId: true } },
      },
    });
    if (!reservation) throw new NotFoundException("Reservation not found");

    let pkg = reservation.package;
    if (!pkg) {
      pkg = await this.prisma.inclusionPackage.findFirst({
        where: {
          organizationId: reservation.branch.organizationId,
          isDefault: true,
          isActive: true,
        },
        include: { rules: { orderBy: { sortOrder: "asc" } } },
      });
    }

    if (!pkg?.rules.length) return [];

    const nights = countStayNights(reservation.checkIn, reservation.checkOut);
    const guestCount = reservation.adultCount + reservation.childCount;

    const results = [];
    for (const rule of pkg.rules) {
      const recipe = await this.prisma.inclusionRecipe.findFirst({
        where: { id: rule.inclusionRecipeId, branchId: reservation.branchId },
      });
      if (!recipe) continue;

      let entitled = 0;
      if (rule.inclusionType === InclusionType.MEAL) {
        const perNight =
          reservation.mealsPerGuestPerNightOverride ??
          rule.quantityPerGuestPerNight ??
          0;
        entitled = nights * guestCount * perNight;
      } else if (rule.inclusionType === InclusionType.AMENITY_KIT) {
        entitled = guestCount * (rule.quantityPerGuestPerStay ?? 0);
      }

      if (entitled <= 0) continue;

      const allowance = await this.prisma.reservationAllowance.upsert({
        where: {
          reservationId_inclusionType_inclusionRecipeId: {
            reservationId,
            inclusionType: rule.inclusionType,
            inclusionRecipeId: rule.inclusionRecipeId,
          },
        },
        create: {
          reservationId,
          inclusionType: rule.inclusionType,
          inclusionRecipeId: rule.inclusionRecipeId,
          entitledQty: entitled,
          consumedQty: 0,
          unitLabel: unitLabelFor(rule.inclusionType),
        },
        update: { entitledQty: entitled },
        include: { recipe: { select: { name: true } } },
      });
      results.push(allowance);
    }
    return results;
  }

  async autoIssueCheckInInclusions(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        package: { include: { rules: true } },
        branch: { select: { organizationId: true } },
      },
    });
    if (!reservation) return;

    let rules = reservation.package?.rules ?? [];
    if (!rules.length) {
      const defaultPkg = await this.prisma.inclusionPackage.findFirst({
        where: {
          organizationId: reservation.branch.organizationId,
          isDefault: true,
          isActive: true,
        },
        include: { rules: true },
      });
      rules = defaultPkg?.rules ?? [];
    }

    for (const rule of rules.filter((r) => r.autoIssueOnCheckIn)) {
      const allowance = await this.prisma.reservationAllowance.findUnique({
        where: {
          reservationId_inclusionType_inclusionRecipeId: {
            reservationId,
            inclusionType: rule.inclusionType,
            inclusionRecipeId: rule.inclusionRecipeId,
          },
        },
      });
      if (!allowance) continue;

      const remaining = allowance.entitledQty - allowance.consumedQty;
      if (remaining <= 0) continue;

      await this.consumeInternal({
        reservationId,
        branchId: reservation.branchId,
        inclusionType: rule.inclusionType as InclusionType,
        inclusionRecipeId: rule.inclusionRecipeId,
        quantity: remaining,
        source: InclusionConsumptionSource.CHECK_IN,
      });
    }
  }

  async consumeManual(
    branchId: string,
    reservationId: string,
    data: {
      inclusionType: InclusionType;
      inclusionRecipeId: string;
      quantity: number;
    },
  ) {
    const reservation = await this.assertReservation(branchId, reservationId);
    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      throw new BadRequestException("Inclusions can only be consumed for checked-in stays");
    }
    if (!Number.isInteger(data.quantity) || data.quantity <= 0) {
      throw new BadRequestException("quantity must be a positive whole number");
    }

    return this.consumeInternal({
      reservationId,
      branchId,
      inclusionType: data.inclusionType,
      inclusionRecipeId: data.inclusionRecipeId,
      quantity: data.quantity,
      source: InclusionConsumptionSource.MANUAL,
    });
  }

  async consumeFromOrder(orderId: string, branchId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId },
      include: {
        lines: { include: { menuItem: true } },
        reservation: true,
      },
    });
    if (!order?.reservationId || !order.reservation) return;
    if (order.reservation.status !== ReservationStatus.CHECKED_IN) return;

    const mealQty = order.lines
      .filter((l) => l.menuItem.isGuestInclusionMeal)
      .reduce((sum, l) => sum + l.quantity, 0);
    if (mealQty <= 0) return;

    const mealAllowance = await this.prisma.reservationAllowance.findFirst({
      where: {
        reservationId: order.reservationId,
        inclusionType: InclusionType.MEAL,
      },
      orderBy: { entitledQty: "desc" },
    });
    if (!mealAllowance) return;

    await this.consumeInternal({
      reservationId: order.reservationId,
      branchId,
      inclusionType: InclusionType.MEAL,
      inclusionRecipeId: mealAllowance.inclusionRecipeId,
      quantity: mealQty,
      source: InclusionConsumptionSource.POS,
      referenceType: "Order",
      referenceId: orderId,
    });
  }

  private async consumeInternal(params: {
    reservationId: string;
    branchId: string;
    inclusionType: InclusionType;
    inclusionRecipeId: string;
    quantity: number;
    source: InclusionConsumptionSource;
    referenceType?: string;
    referenceId?: string;
  }) {
    const allowance = await this.prisma.reservationAllowance.findUnique({
      where: {
        reservationId_inclusionType_inclusionRecipeId: {
          reservationId: params.reservationId,
          inclusionType: params.inclusionType,
          inclusionRecipeId: params.inclusionRecipeId,
        },
      },
    });
    if (!allowance) {
      throw new BadRequestException("No allowance found for this inclusion");
    }

    if (allowance.consumedQty + params.quantity > allowance.entitledQty) {
      throw new BadRequestException(
        `Cannot consume ${params.quantity}: only ${allowance.entitledQty - allowance.consumedQty} remaining`,
      );
    }

    const recipe = await this.getRecipe(params.branchId, params.inclusionRecipeId);

    const consumption = await this.prisma.inclusionConsumption.create({
      data: {
        reservationId: params.reservationId,
        allowanceId: allowance.id,
        branchId: params.branchId,
        quantity: params.quantity,
        source: params.source,
        referenceType: params.referenceType ?? null,
        referenceId: params.referenceId ?? null,
      },
    });

    await this.prisma.reservationAllowance.update({
      where: { id: allowance.id },
      data: { consumedQty: allowance.consumedQty + params.quantity },
    });

    for (const line of recipe.lines) {
      const qty = toNumber(line.quantity) * params.quantity;
      await this.inventory.createMovement({
        itemId: line.inventoryItemId,
        branchId: params.branchId,
        movementType: MovementType.GUEST_INCLUSION,
        quantity: qty,
        referenceType: "InclusionConsumption",
        referenceId: consumption.id,
      });
    }

    return consumption;
  }

  async reconcileAllowances(branchId: string, reservationId: string) {
    const reservation = await this.assertReservation(branchId, reservationId);
    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      throw new BadRequestException("Allowances can only be reconciled for checked-in stays");
    }

    const before = await this.prisma.reservationAllowance.findMany({
      where: { reservationId },
    });
    const consumedByKey = new Map(
      before.map((a) => [`${a.inclusionType}:${a.inclusionRecipeId}`, a.consumedQty]),
    );

    await this.snapshotAllowances(reservationId);

    const after = await this.prisma.reservationAllowance.findMany({
      where: { reservationId },
      include: { recipe: { select: { name: true } } },
    });

    for (const a of after) {
      const prev = consumedByKey.get(`${a.inclusionType}:${a.inclusionRecipeId}`) ?? 0;
      if (prev > a.entitledQty) {
        throw new BadRequestException(
          `Reconcile would leave consumed (${prev}) above new entitlement (${a.entitledQty}) for ${a.recipe.name}`,
        );
      }
      if (a.consumedQty !== prev) {
        await this.prisma.reservationAllowance.update({
          where: { id: a.id },
          data: { consumedQty: prev },
        });
      }
    }

    return this.listAllowances(branchId, reservationId);
  }

  private async assertReservation(branchId: string, reservationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, branchId },
    });
    if (!reservation) throw new NotFoundException("Reservation not found");
    return reservation;
  }

  async assertPackageInOrg(organizationId: string, packageId: string | null | undefined) {
    if (!packageId) return;
    await this.getPackage(organizationId, packageId);
  }
}

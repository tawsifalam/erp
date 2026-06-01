import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditAction, AuditEntityType } from "../audit/audit.constants";
import { AuditService } from "../audit/audit.service";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

@Injectable()
export class RatePlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(organizationId: string) {
    return this.prisma.ratePlan.findMany({
      where: { organizationId },
      include: {
        roomType: true,
        rules: { orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ validFrom: "desc" }, { name: "asc" }],
    });
  }

  async create(
    organizationId: string,
    data: {
      roomTypeId: string;
      name: string;
      validFrom: string;
      validTo: string;
      baseModifier?: number;
      isActive?: boolean;
    },
    userId?: string,
  ) {
    await this.assertRoomType(organizationId, data.roomTypeId);
    const validFrom = new Date(data.validFrom);
    const validTo = new Date(data.validTo);
    if (validTo < validFrom) {
      throw new BadRequestException("validTo must be on or after validFrom");
    }
    if (!data.name?.trim()) throw new BadRequestException("name is required");
    const baseModifier = data.baseModifier ?? 1;
    if (baseModifier <= 0) {
      throw new BadRequestException("baseModifier must be positive");
    }

    const plan = await this.prisma.ratePlan.create({
      data: {
        organizationId,
        roomTypeId: data.roomTypeId,
        name: data.name.trim(),
        validFrom,
        validTo,
        baseModifier,
        isActive: data.isActive ?? true,
      },
      include: { roomType: true, rules: true },
    });
    await this.audit.record({
      organizationId,
      userId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.RATE_PLAN,
      entityId: plan.id,
      metadata: { name: plan.name },
    });
    return plan;
  }

  async update(
    organizationId: string,
    id: string,
    data: {
      name?: string;
      validFrom?: string;
      validTo?: string;
      baseModifier?: number;
      isActive?: boolean;
    },
    userId?: string,
  ) {
    const existing = await this.get(organizationId, id);
    const validFrom = data.validFrom ? new Date(data.validFrom) : existing.validFrom;
    const validTo = data.validTo ? new Date(data.validTo) : existing.validTo;
    if (validTo < validFrom) {
      throw new BadRequestException("validTo must be on or after validFrom");
    }
    if (data.baseModifier != null && data.baseModifier <= 0) {
      throw new BadRequestException("baseModifier must be positive");
    }

    const plan = await this.prisma.ratePlan.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.validFrom !== undefined ? { validFrom } : {}),
        ...(data.validTo !== undefined ? { validTo } : {}),
        ...(data.baseModifier !== undefined ? { baseModifier: data.baseModifier } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: { roomType: true, rules: true },
    });
    await this.audit.record({
      organizationId,
      userId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.RATE_PLAN,
      entityId: id,
    });
    return plan;
  }

  async delete(organizationId: string, id: string, userId?: string) {
    await this.get(organizationId, id);
    await this.prisma.ratePlan.delete({ where: { id } });
    await this.audit.record({
      organizationId,
      userId,
      action: AuditAction.DELETE,
      entityType: AuditEntityType.RATE_PLAN,
      entityId: id,
    });
    return { deleted: true, id };
  }

  async addRule(
    organizationId: string,
    ratePlanId: string,
    data: {
      dayOfWeek?: number | null;
      minStayNights?: number | null;
      pricePerNight?: number | null;
    },
    userId?: string,
  ) {
    await this.get(organizationId, ratePlanId);
    if (data.dayOfWeek != null && (data.dayOfWeek < 0 || data.dayOfWeek > 6)) {
      throw new BadRequestException(`dayOfWeek must be 0–6 (${DAY_LABELS.join(", ")})`);
    }
    if (data.minStayNights != null && data.minStayNights < 1) {
      throw new BadRequestException("minStayNights must be at least 1");
    }
    if (data.pricePerNight != null && data.pricePerNight < 0) {
      throw new BadRequestException("pricePerNight cannot be negative");
    }

    const rule = await this.prisma.rateRule.create({
      data: {
        ratePlanId,
        dayOfWeek: data.dayOfWeek ?? null,
        minStayNights: data.minStayNights ?? null,
        pricePerNight: data.pricePerNight ?? null,
      },
    });
    await this.audit.record({
      organizationId,
      userId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.RATE_RULE,
      entityId: rule.id,
      metadata: { ratePlanId },
    });
    return rule;
  }

  async deleteRule(
    organizationId: string,
    ratePlanId: string,
    ruleId: string,
    userId?: string,
  ) {
    await this.get(organizationId, ratePlanId);
    const rule = await this.prisma.rateRule.findFirst({
      where: { id: ruleId, ratePlanId },
    });
    if (!rule) throw new NotFoundException("Rate rule not found");
    await this.prisma.rateRule.delete({ where: { id: ruleId } });
    await this.audit.record({
      organizationId,
      userId,
      action: AuditAction.DELETE,
      entityType: AuditEntityType.RATE_RULE,
      entityId: ruleId,
      metadata: { ratePlanId },
    });
    return { deleted: true, id: ruleId };
  }

  private async get(organizationId: string, id: string) {
    const plan = await this.prisma.ratePlan.findFirst({
      where: { id, organizationId },
      include: { roomType: true, rules: true },
    });
    if (!plan) throw new NotFoundException("Rate plan not found");
    return plan;
  }

  private async assertRoomType(organizationId: string, roomTypeId: string) {
    const rt = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, organizationId },
    });
    if (!rt) throw new NotFoundException("Room type not found");
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { roundMoney, toNumber } from "@erp/utils";

export type StayQuote = {
  totalAmount: number;
  roomAmount: number;
  fbAmount: number;
  nights: number;
  ratePlanId: string | null;
  ratePlanName: string | null;
  inclusionPackageId: string | null;
  inclusionPackageName: string | null;
  nightlyBreakdown: { date: string; amount: number }[];
};

@Injectable()
export class RatePricingService {
  constructor(private readonly prisma: PrismaService) {}

  async quoteStay(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    adultCount = 1,
    childCount = 0,
  ): Promise<StayQuote> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { roomType: true, branch: { select: { organizationId: true } } },
    });
    if (!room) throw new NotFoundException("Room not found");

    const nights = this.countNights(checkIn, checkOut);
    const nightDates = this.eachNightDate(checkIn, nights);
    const organizationId = room.branch.organizationId;

    const plan = await this.findApplicablePlan(
      organizationId,
      room.roomTypeId,
      checkIn,
      checkOut,
    );

    const basePrice = toNumber(room.basePrice);
    const rules = plan?.rules ?? [];
    const stayNights = nights;
    const modifier = plan ? toNumber(plan.baseModifier) : 1;

    const nightlyBreakdown = nightDates.map((night) => {
      const amount = this.nightlyRate(
        rules,
        night,
        stayNights,
        basePrice,
        modifier,
      );
      return { date: night.toISOString().slice(0, 10), amount };
    });

    const roomAmount = roundMoney(
      nightlyBreakdown.reduce((sum, n) => sum + n.amount, 0),
    );

    const guests = Math.max(1, adultCount + childCount);
    const supplement = plan?.fbSupplementPerGuestPerNight
      ? toNumber(plan.fbSupplementPerGuestPerNight)
      : 0;
    const bundlePackage =
      plan?.inclusionPackageId && plan.inclusionPackage?.isActive !== false
        ? plan.inclusionPackage
        : null;
    const hasBundle = Boolean(bundlePackage);
    const fbAmount =
      hasBundle && supplement > 0
        ? roundMoney(supplement * guests * nights)
        : 0;
    const totalAmount = roundMoney(roomAmount + fbAmount);

    return {
      totalAmount,
      roomAmount,
      fbAmount,
      nights,
      ratePlanId: plan?.id ?? null,
      ratePlanName: plan?.name ?? null,
      inclusionPackageId: hasBundle ? plan!.inclusionPackageId : null,
      inclusionPackageName: bundlePackage?.name ?? null,
      nightlyBreakdown,
    };
  }

  private async findApplicablePlan(
    organizationId: string,
    roomTypeId: string,
    checkIn: Date,
    checkOut: Date,
  ) {
    const plans = await this.prisma.ratePlan.findMany({
      where: {
        organizationId,
        roomTypeId,
        isActive: true,
        validFrom: { lte: checkOut },
        validTo: { gte: checkIn },
      },
      include: {
        rules: true,
        inclusionPackage: { select: { id: true, name: true, isActive: true } },
      },
      orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
    });
    return plans[0] ?? null;
  }

  private countNights(checkIn: Date, checkOut: Date) {
    if (checkOut <= checkIn) {
      throw new BadRequestException("checkOut must be after checkIn");
    }
    const ms = checkOut.getTime() - checkIn.getTime();
    const nights = Math.round(ms / (24 * 60 * 60 * 1000));
    if (nights < 1) {
      throw new BadRequestException("Stay must be at least one night");
    }
    return nights;
  }

  private eachNightDate(checkIn: Date, nights: number) {
    const dates: Date[] = [];
    for (let i = 0; i < nights; i++) {
      const d = new Date(checkIn);
      d.setUTCDate(d.getUTCDate() + i);
      dates.push(d);
    }
    return dates;
  }

  private nightlyRate(
    rules: {
      dayOfWeek: number | null;
      minStayNights: number | null;
      pricePerNight: unknown;
    }[],
    night: Date,
    stayNights: number,
    basePrice: number,
    baseModifier: number,
  ) {
    const dow = night.getUTCDay();
    const matching = rules.filter(
      (r) =>
        (r.dayOfWeek == null || r.dayOfWeek === dow) &&
        (r.minStayNights == null || r.minStayNights <= stayNights),
    );
    const daySpecific = matching.filter((r) => r.dayOfWeek != null);
    const picked = daySpecific[0] ?? matching[0];
    if (picked?.pricePerNight != null) {
      return roundMoney(toNumber(picked.pricePerNight));
    }
    return roundMoney(basePrice * baseModifier);
  }
}

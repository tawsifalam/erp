import { Test, TestingModule } from "@nestjs/testing";
import { RatePricingService } from "./rate-pricing.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
  room: { findUnique: jest.fn() },
  ratePlan: { findMany: jest.fn() },
};

describe("RatePricingService", () => {
  let service: RatePricingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatePricingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(RatePricingService);
  });

  it("quotes base price when no rate plan applies", async () => {
    mockPrisma.room.findUnique.mockResolvedValue({
      id: "rm_1",
      basePrice: 3500,
      roomTypeId: "rt_1",
      branch: { organizationId: "org_1" },
      roomType: { name: "Standard" },
    });
    mockPrisma.ratePlan.findMany.mockResolvedValue([]);

    const quote = await service.quoteStay(
      "rm_1",
      new Date("2026-06-01T14:00:00Z"),
      new Date("2026-06-03T11:00:00Z"),
    );

    expect(quote.nights).toBe(2);
    expect(quote.totalAmount).toBe(7000);
    expect(quote.ratePlanId).toBeNull();
  });

  it("applies weekend rule override", async () => {
    mockPrisma.room.findUnique.mockResolvedValue({
      id: "rm_1",
      basePrice: 3500,
      roomTypeId: "rt_1",
      branch: { organizationId: "org_1" },
      roomType: { name: "Standard" },
    });
    mockPrisma.ratePlan.findMany.mockResolvedValue([
      {
        id: "rp_1",
        name: "Summer",
        baseModifier: 1,
        rules: [{ dayOfWeek: 6, minStayNights: null, pricePerNight: 5000 }],
      },
    ]);

    // Fri–Sun: 2026-06-05 is Friday, 06 Sat, 07 Sun checkout = 2 nights Fri+Sat
    const quote = await service.quoteStay(
      "rm_1",
      new Date("2026-06-05T14:00:00Z"),
      new Date("2026-06-07T11:00:00Z"),
    );

    expect(quote.ratePlanId).toBe("rp_1");
    expect(quote.totalAmount).toBe(8500);
  });
});

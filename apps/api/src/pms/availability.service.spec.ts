import { Test, TestingModule } from "@nestjs/testing";
import { ReservationStatus } from "@prisma/client";
import { AvailabilityService } from "./availability.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
  room: { findMany: jest.fn() },
};

describe("AvailabilityService", () => {
  let service: AvailabilityService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(AvailabilityService);
  });

  it("excludes rooms with overlapping CONFIRMED reservations", async () => {
    mockPrisma.room.findMany.mockResolvedValue([
      {
        id: "rm_1",
        roomNumber: "101",
        status: "VACANT",
        roomType: { name: "Standard" },
        reservations: [
          {
            id: "res_1",
            status: ReservationStatus.CONFIRMED,
            checkIn: new Date("2026-06-01"),
            checkOut: new Date("2026-06-05"),
          },
        ],
      },
      {
        id: "rm_2",
        roomNumber: "102",
        status: "VACANT",
        roomType: { name: "Standard" },
        reservations: [],
      },
    ]);

    const available = await service.findAvailableRooms({
      branchId: "br_1",
      checkIn: new Date("2026-06-02"),
      checkOut: new Date("2026-06-04"),
    });

    expect(available.map((r) => r.id)).toEqual(["rm_2"]);
  });

  it("excludes MAINTENANCE rooms from query", async () => {
    await service.findAvailableRooms({
      branchId: "br_1",
      checkIn: new Date("2026-06-01"),
      checkOut: new Date("2026-06-03"),
    });

    expect(mockPrisma.room.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: "br_1",
          status: { not: "MAINTENANCE" },
        }),
      }),
    );
  });
});

import { Injectable } from "@nestjs/common";
import { ReservationStatus } from "@prisma/client";
import { rangesOverlap } from "@erp/utils";
import { PrismaService } from "../prisma/prisma.service";

const BLOCKING: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async findAvailableRooms(params: {
    branchId: string;
    checkIn: Date;
    checkOut: Date;
    roomTypeId?: string;
    excludeReservationId?: string;
  }) {
    const rooms = await this.prisma.room.findMany({
      where: {
        branchId: params.branchId,
        status: { not: "MAINTENANCE" },
        ...(params.roomTypeId ? { roomTypeId: params.roomTypeId } : {}),
      },
      include: {
        roomType: true,
        reservations: {
          where: {
            status: { in: BLOCKING },
            ...(params.excludeReservationId
              ? { id: { not: params.excludeReservationId } }
              : {}),
          },
        },
      },
      orderBy: { roomNumber: "asc" },
    });

    return rooms.filter((room) => {
      const overlaps = room.reservations.some((r) =>
        rangesOverlap(params.checkIn, params.checkOut, r.checkIn, r.checkOut),
      );
      return !overlaps;
    });
  }
}

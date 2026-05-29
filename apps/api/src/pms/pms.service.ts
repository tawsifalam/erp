import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ReservationStatus, RoomStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AvailabilityService } from "./availability.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ReservationCheckedInEvent } from "../common/events/reservation-checked-in.event";

@Injectable()
export class PmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly realtime: RealtimeGateway,
    private readonly events: EventEmitter2,
  ) {}

  listBranches(organizationId: string) {
    return this.prisma.branch.findMany({ where: { organizationId } });
  }

  createBranch(organizationId: string, data: { name: string; timezone: string }) {
    return this.prisma.branch.create({ data: { organizationId, ...data } });
  }

  listRoomTypes(organizationId: string) {
    return this.prisma.roomType.findMany({ where: { organizationId } });
  }

  createRoomType(
    organizationId: string,
    data: { name: string; maxAdults: number; maxChildren: number },
  ) {
    return this.prisma.roomType.create({ data: { organizationId, ...data } });
  }

  listRooms(branchId: string) {
    return this.prisma.room.findMany({
      where: { branchId },
      include: { roomType: true },
    });
  }

  createRoom(
    branchId: string,
    data: {
      roomTypeId: string;
      roomNumber: string;
      basePrice: number;
      status?: RoomStatus;
    },
  ) {
    return this.prisma.room.create({
      data: {
        branchId,
        roomTypeId: data.roomTypeId,
        roomNumber: data.roomNumber,
        basePrice: data.basePrice,
        status: data.status ?? RoomStatus.VACANT,
      },
    });
  }

  listGuests(organizationId: string) {
    return this.prisma.guest.findMany({ where: { organizationId } });
  }

  createGuest(
    organizationId: string,
    data: { fullName: string; phone?: string; email?: string },
  ) {
    return this.prisma.guest.create({ data: { organizationId, ...data } });
  }

  listReservations(branchId: string) {
    return this.prisma.reservation.findMany({
      where: { branchId },
      include: { guest: true, room: true },
      orderBy: { checkIn: "asc" },
    });
  }

  async createReservation(
    branchId: string,
    data: {
      guestId: string;
      roomId: string;
      checkIn: Date;
      checkOut: Date;
      totalAmount: number;
      status?: ReservationStatus;
    },
  ) {
    if (data.checkOut <= data.checkIn) {
      throw new BadRequestException("checkOut must be after checkIn");
    }

    const available = await this.availability.findAvailableRooms({
      branchId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
    });

    if (!available.some((r) => r.id === data.roomId)) {
      throw new BadRequestException("Room not available for selected dates");
    }

    return this.prisma.reservation.create({
      data: {
        branchId,
        guestId: data.guestId,
        roomId: data.roomId,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        totalAmount: data.totalAmount,
        status: data.status ?? ReservationStatus.CONFIRMED,
      },
      include: { guest: true, room: true },
    });
  }

  async checkIn(reservationId: string, branchId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, branchId },
    });
    if (!reservation) throw new NotFoundException("Reservation not found");

    const updated = await this.prisma.$transaction([
      this.prisma.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.CHECKED_IN },
      }),
      this.prisma.room.update({
        where: { id: reservation.roomId },
        data: { status: RoomStatus.OCCUPIED },
      }),
    ]);

    this.events.emit(
      "reservation.checked_in",
      new ReservationCheckedInEvent(reservationId, reservation.roomId, branchId),
    );
    this.realtime.emitRoomStatus(branchId, reservation.roomId, RoomStatus.OCCUPIED);

    return updated[0];
  }

  async checkOut(reservationId: string, branchId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, branchId },
    });
    if (!reservation) throw new NotFoundException("Reservation not found");

    const [updated] = await this.prisma.$transaction([
      this.prisma.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.CHECKED_OUT },
      }),
      this.prisma.room.update({
        where: { id: reservation.roomId },
        data: { status: RoomStatus.DIRTY },
      }),
    ]);

    this.realtime.emitRoomStatus(branchId, reservation.roomId, RoomStatus.DIRTY);
    return updated;
  }

  async cancelReservation(reservationId: string, branchId: string) {
    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CANCELLED },
    });
  }
}

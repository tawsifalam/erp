import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ReservationStatus, RoomStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AvailabilityService } from "./availability.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ReservationCheckedInEvent } from "../common/events/reservation-checked-in.event";

const CANCELLABLE: ReservationStatus[] = [
  ReservationStatus.INQUIRY,
  ReservationStatus.CONFIRMED,
];

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

  async updateRoomType(
    organizationId: string,
    roomTypeId: string,
    data: { name?: string; maxAdults?: number; maxChildren?: number },
  ) {
    const existing = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, organizationId },
    });
    if (!existing) throw new NotFoundException("Room type not found");
    return this.prisma.roomType.update({ where: { id: roomTypeId }, data });
  }

  listRooms(branchId: string) {
    return this.prisma.room.findMany({
      where: { branchId },
      include: { roomType: true },
      orderBy: { roomNumber: "asc" },
    });
  }

  async getRoom(branchId: string, roomId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, branchId },
      include: { roomType: true },
    });
    if (!room) throw new NotFoundException("Room not found");
    return room;
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
      include: { roomType: true },
    });
  }

  async updateRoom(
    branchId: string,
    roomId: string,
    data: {
      roomTypeId?: string;
      roomNumber?: string;
      basePrice?: number;
    },
  ) {
    await this.getRoom(branchId, roomId);
    return this.prisma.room.update({
      where: { id: roomId },
      data,
      include: { roomType: true },
    });
  }

  async updateRoomStatus(branchId: string, roomId: string, status: RoomStatus) {
    const room = await this.getRoom(branchId, roomId);

    if (status === RoomStatus.OCCUPIED) {
      throw new BadRequestException(
        "Use check-in to mark a room occupied; housekeeping cannot set OCCUPIED",
      );
    }

    if (room.status === RoomStatus.OCCUPIED && status !== RoomStatus.DIRTY) {
      throw new BadRequestException(
        "Occupied rooms can only move to DIRTY via check-out",
      );
    }

    const allowed: Partial<Record<RoomStatus, RoomStatus[]>> = {
      [RoomStatus.VACANT]: [RoomStatus.MAINTENANCE],
      [RoomStatus.DIRTY]: [RoomStatus.VACANT],
      [RoomStatus.MAINTENANCE]: [RoomStatus.VACANT],
    };

    const from = room.status as RoomStatus;
    if (from !== status && !(allowed[from]?.includes(status) ?? false)) {
      throw new BadRequestException(
        `Cannot change room status from ${from} to ${status}`,
      );
    }

    const updated = await this.prisma.room.update({
      where: { id: roomId },
      data: { status },
      include: { roomType: true },
    });

    this.realtime.emitRoomStatus(branchId, roomId, status);
    return updated;
  }

  listGuests(organizationId: string) {
    return this.prisma.guest.findMany({
      where: { organizationId },
      orderBy: { fullName: "asc" },
    });
  }

  async getGuest(organizationId: string, guestId: string) {
    const guest = await this.prisma.guest.findFirst({
      where: { id: guestId, organizationId },
    });
    if (!guest) throw new NotFoundException("Guest not found");
    return guest;
  }

  createGuest(
    organizationId: string,
    data: { fullName: string; phone?: string; email?: string },
  ) {
    return this.prisma.guest.create({ data: { organizationId, ...data } });
  }

  async updateGuest(
    organizationId: string,
    guestId: string,
    data: { fullName?: string; phone?: string; email?: string },
  ) {
    await this.getGuest(organizationId, guestId);
    return this.prisma.guest.update({ where: { id: guestId }, data });
  }

  async deleteGuest(organizationId: string, guestId: string) {
    await this.getGuest(organizationId, guestId);
    const active = await this.prisma.reservation.count({
      where: {
        guestId,
        status: {
          in: [
            ReservationStatus.INQUIRY,
            ReservationStatus.CONFIRMED,
            ReservationStatus.CHECKED_IN,
          ],
        },
      },
    });
    if (active > 0) {
      throw new ConflictException("Guest has active reservations and cannot be deleted");
    }
    return this.prisma.guest.delete({ where: { id: guestId } });
  }

  listReservations(branchId: string) {
    return this.prisma.reservation.findMany({
      where: { branchId },
      include: { guest: true, room: { include: { roomType: true } } },
      orderBy: { checkIn: "asc" },
    });
  }

  async getReservation(branchId: string, reservationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, branchId },
      include: { guest: true, room: { include: { roomType: true } } },
    });
    if (!reservation) throw new NotFoundException("Reservation not found");
    return reservation;
  }

  private validateDates(checkIn: Date, checkOut: Date) {
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      throw new BadRequestException("checkIn and checkOut must be valid dates");
    }
    if (checkOut <= checkIn) {
      throw new BadRequestException("checkOut must be after checkIn");
    }
  }

  private validateReservationFields(data: {
    guestId: string;
    roomId: string;
    checkIn: Date;
    checkOut: Date;
    totalAmount: number;
  }) {
    if (!data.guestId?.trim()) {
      throw new BadRequestException("guestId is required");
    }
    if (!data.roomId?.trim()) {
      throw new BadRequestException("roomId is required");
    }
    if (!Number.isFinite(data.totalAmount) || data.totalAmount < 0) {
      throw new BadRequestException("totalAmount must be a non-negative number");
    }
    this.validateDates(data.checkIn, data.checkOut);
  }

  private async assertRoomAvailable(
    branchId: string,
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    excludeReservationId?: string,
  ) {
    const available = await this.availability.findAvailableRooms({
      branchId,
      checkIn,
      checkOut,
      excludeReservationId,
    });

    if (!available.some((r) => r.id === roomId)) {
      throw new BadRequestException("Room not available for selected dates");
    }
  }

  async createReservation(
    branchId: string,
    data: {
      guestId: string;
      roomId: string;
      checkIn: Date;
      checkOut: Date;
      totalAmount: number;
      paidAmount?: number;
      status?: ReservationStatus;
    },
  ) {
    this.validateReservationFields(data);

    const status = data.status ?? ReservationStatus.CONFIRMED;

    if (status === ReservationStatus.INQUIRY) {
      return this.prisma.reservation.create({
        data: {
          branchId,
          guestId: data.guestId,
          roomId: data.roomId,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          totalAmount: data.totalAmount,
          paidAmount: data.paidAmount ?? 0,
          status: ReservationStatus.INQUIRY,
        },
        include: { guest: true, room: { include: { roomType: true } } },
      });
    }

    await this.assertRoomAvailable(branchId, data.roomId, data.checkIn, data.checkOut);

    return this.prisma.reservation.create({
      data: {
        branchId,
        guestId: data.guestId,
        roomId: data.roomId,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        totalAmount: data.totalAmount,
        paidAmount: data.paidAmount ?? 0,
        status,
      },
      include: { guest: true, room: { include: { roomType: true } } },
    });
  }

  async updateReservation(
    branchId: string,
    reservationId: string,
    data: {
      guestId?: string;
      roomId?: string;
      checkIn?: Date;
      checkOut?: Date;
      totalAmount?: number;
      paidAmount?: number;
    },
  ) {
    const reservation = await this.getReservation(branchId, reservationId);

    if (
      reservation.status === ReservationStatus.CHECKED_OUT ||
      reservation.status === ReservationStatus.CANCELLED
    ) {
      throw new BadRequestException("Cannot update a closed reservation");
    }

    if (reservation.status === ReservationStatus.CHECKED_IN) {
      const allowed = ["paidAmount", "totalAmount"] as const;
      const keys = Object.keys(data) as (keyof typeof data)[];
      if (keys.some((k) => !allowed.includes(k as (typeof allowed)[number]))) {
        throw new BadRequestException(
          "Checked-in reservations can only update totalAmount or paidAmount",
        );
      }
    }

    const checkIn = data.checkIn ?? reservation.checkIn;
    const checkOut = data.checkOut ?? reservation.checkOut;
    const roomId = data.roomId ?? reservation.roomId;

    if (data.checkIn || data.checkOut || data.roomId) {
      this.validateDates(checkIn, checkOut);
      if (reservation.status !== ReservationStatus.INQUIRY) {
        await this.assertRoomAvailable(
          branchId,
          roomId,
          checkIn,
          checkOut,
          reservationId,
        );
      }
    }

    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        ...(data.guestId !== undefined ? { guestId: data.guestId } : {}),
        ...(data.roomId !== undefined ? { roomId: data.roomId } : {}),
        ...(data.checkIn !== undefined ? { checkIn: data.checkIn } : {}),
        ...(data.checkOut !== undefined ? { checkOut: data.checkOut } : {}),
        ...(data.totalAmount !== undefined ? { totalAmount: data.totalAmount } : {}),
        ...(data.paidAmount !== undefined ? { paidAmount: data.paidAmount } : {}),
      },
      include: { guest: true, room: { include: { roomType: true } } },
    });
  }

  async confirmReservation(branchId: string, reservationId: string) {
    const reservation = await this.getReservation(branchId, reservationId);

    if (reservation.status !== ReservationStatus.INQUIRY) {
      throw new BadRequestException("Only INQUIRY reservations can be confirmed");
    }

    await this.assertRoomAvailable(
      branchId,
      reservation.roomId,
      reservation.checkIn,
      reservation.checkOut,
      reservationId,
    );

    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CONFIRMED },
      include: { guest: true, room: { include: { roomType: true } } },
    });
  }

  async recordPayment(
    branchId: string,
    reservationId: string,
    paidAmount: number,
  ) {
    const reservation = await this.getReservation(branchId, reservationId);

    if (paidAmount < 0) {
      throw new BadRequestException("paidAmount cannot be negative");
    }

    const total = Number(reservation.totalAmount);
    if (paidAmount > total) {
      throw new BadRequestException("paidAmount cannot exceed totalAmount");
    }

    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: { paidAmount },
      include: { guest: true, room: { include: { roomType: true } } },
    });
  }

  async checkIn(reservationId: string, branchId: string) {
    const reservation = await this.getReservation(branchId, reservationId);

    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new BadRequestException("Only CONFIRMED reservations can be checked in");
    }

    await this.prisma.$transaction([
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

    return this.getReservation(branchId, reservationId);
  }

  async checkOut(reservationId: string, branchId: string) {
    const reservation = await this.getReservation(branchId, reservationId);

    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      throw new BadRequestException("Only CHECKED_IN reservations can be checked out");
    }

    await this.prisma.$transaction([
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
    return this.getReservation(branchId, reservationId);
  }

  async cancelReservation(reservationId: string, branchId: string) {
    const reservation = await this.getReservation(branchId, reservationId);

    if (!CANCELLABLE.includes(reservation.status)) {
      throw new BadRequestException(
        "Only INQUIRY or CONFIRMED reservations can be cancelled",
      );
    }

    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CANCELLED },
      include: { guest: true, room: { include: { roomType: true } } },
    });
  }
}

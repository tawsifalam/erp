import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ReservationStatus, RoomStatus } from "@prisma/client";
import { PmsService } from "./pms.service";
import { PrismaService } from "../prisma/prisma.service";
import { AvailabilityService } from "./availability.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { EventEmitter2 } from "@nestjs/event-emitter";

const mockPrisma = {
  branch: { findMany: jest.fn(), create: jest.fn() },
  roomType: { findMany: jest.fn(), create: jest.fn() },
  room: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  guest: { findMany: jest.fn(), create: jest.fn() },
  reservation: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAvailability = {
  findAvailableRooms: jest.fn(),
};

const mockRealtime = {
  emitRoomStatus: jest.fn(),
  emitKitchenTicket: jest.fn(),
  emitOrderUpdate: jest.fn(),
};

const mockEvents = {
  emit: jest.fn(),
};

describe("PmsService", () => {
  let service: PmsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PmsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AvailabilityService, useValue: mockAvailability },
        { provide: RealtimeGateway, useValue: mockRealtime },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<PmsService>(PmsService);
  });

  describe("createReservation", () => {
    const checkIn = new Date("2026-06-01");
    const checkOut = new Date("2026-06-03");

    it("throws when checkOut <= checkIn", async () => {
      await expect(
        service.createReservation("branch-1", {
          guestId: "g-1",
          roomId: "room-1",
          checkIn: new Date("2026-06-05"),
          checkOut: new Date("2026-06-03"),
          totalAmount: 200,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws when checkOut equals checkIn", async () => {
      const sameDate = new Date("2026-06-05");
      await expect(
        service.createReservation("branch-1", {
          guestId: "g-1",
          roomId: "room-1",
          checkIn: sameDate,
          checkOut: sameDate,
          totalAmount: 200,
        }),
      ).rejects.toThrow("checkOut must be after checkIn");
    });

    it("throws when guestId is missing", async () => {
      await expect(
        service.createReservation("branch-1", {
          guestId: "",
          roomId: "room-1",
          checkIn: new Date("2026-06-01"),
          checkOut: new Date("2026-06-03"),
          totalAmount: 200,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws when dates are invalid", async () => {
      await expect(
        service.createReservation("branch-1", {
          guestId: "g-1",
          roomId: "room-1",
          checkIn: new Date("invalid"),
          checkOut: new Date("invalid"),
          totalAmount: 200,
          status: ReservationStatus.INQUIRY,
        }),
      ).rejects.toThrow("valid dates");
    });

    it("throws when room is not available", async () => {
      mockAvailability.findAvailableRooms.mockResolvedValue([
        { id: "room-other" },
      ]);

      await expect(
        service.createReservation("branch-1", {
          guestId: "g-1",
          roomId: "room-1",
          checkIn,
          checkOut,
          totalAmount: 200,
        }),
      ).rejects.toThrow("Room not available for selected dates");
    });

    it("creates reservation when room is available", async () => {
      mockAvailability.findAvailableRooms.mockResolvedValue([
        { id: "room-1" },
      ]);
      const created = { id: "res-1", status: ReservationStatus.CONFIRMED };
      mockPrisma.reservation.create.mockResolvedValue(created);

      const result = await service.createReservation("branch-1", {
        guestId: "g-1",
        roomId: "room-1",
        checkIn,
        checkOut,
        totalAmount: 200,
      });

      expect(result).toEqual(created);
      expect(mockPrisma.reservation.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          guestId: "g-1",
          roomId: "room-1",
          checkIn,
          checkOut,
          totalAmount: 200,
          paidAmount: 0,
          status: ReservationStatus.CONFIRMED,
        },
        include: { guest: true, room: { include: { roomType: true } } },
      });
    });

    it("passes availability check with correct params", async () => {
      mockAvailability.findAvailableRooms.mockResolvedValue([
        { id: "room-1" },
      ]);
      mockPrisma.reservation.create.mockResolvedValue({ id: "res-1" });

      await service.createReservation("branch-1", {
        guestId: "g-1",
        roomId: "room-1",
        checkIn,
        checkOut,
        totalAmount: 200,
      });

      expect(mockAvailability.findAvailableRooms).toHaveBeenCalledWith({
        branchId: "branch-1",
        checkIn,
        checkOut,
      });
    });
  });

  describe("checkIn", () => {
    it("throws NotFoundException when reservation not found", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue(null);

      await expect(
        service.checkIn("res-1", "branch-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws when reservation is not CONFIRMED", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: "res-1",
        roomId: "room-1",
        branchId: "branch-1",
        status: ReservationStatus.INQUIRY,
      });

      await expect(service.checkIn("res-1", "branch-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("updates reservation to CHECKED_IN and room to OCCUPIED", async () => {
      const reservation = {
        id: "res-1",
        roomId: "room-1",
        branchId: "branch-1",
        status: ReservationStatus.CONFIRMED,
      };
      const after = { ...reservation, status: ReservationStatus.CHECKED_IN };
      mockPrisma.reservation.findFirst
        .mockResolvedValueOnce(reservation)
        .mockResolvedValueOnce(after);

      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.checkIn("res-1", "branch-1");

      expect(result).toEqual(after);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith([
        mockPrisma.reservation.update({
          where: { id: "res-1" },
          data: { status: ReservationStatus.CHECKED_IN },
        }),
        mockPrisma.room.update({
          where: { id: "room-1" },
          data: { status: RoomStatus.OCCUPIED },
        }),
      ]);
    });

    it("emits reservation.checked_in event", async () => {
      const reservation = {
        id: "res-1",
        roomId: "room-1",
        branchId: "branch-1",
        status: ReservationStatus.CONFIRMED,
      };
      mockPrisma.reservation.findFirst
        .mockResolvedValueOnce(reservation)
        .mockResolvedValueOnce({ ...reservation, status: ReservationStatus.CHECKED_IN });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      await service.checkIn("res-1", "branch-1");

      expect(mockEvents.emit).toHaveBeenCalledWith(
        "reservation.checked_in",
        expect.objectContaining({
          reservationId: "res-1",
          roomId: "room-1",
          branchId: "branch-1",
        }),
      );
    });

    it("emits room status via realtime gateway", async () => {
      const reservation = {
        id: "res-1",
        roomId: "room-1",
        branchId: "branch-1",
        status: ReservationStatus.CONFIRMED,
      };
      mockPrisma.reservation.findFirst
        .mockResolvedValueOnce(reservation)
        .mockResolvedValueOnce(reservation);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      await service.checkIn("res-1", "branch-1");

      expect(mockRealtime.emitRoomStatus).toHaveBeenCalledWith(
        "branch-1",
        "room-1",
        RoomStatus.OCCUPIED,
      );
    });
  });

  describe("checkOut", () => {
    it("throws NotFoundException when reservation not found", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue(null);

      await expect(
        service.checkOut("res-1", "branch-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("updates reservation to CHECKED_OUT and room to DIRTY", async () => {
      const reservation = {
        id: "res-1",
        roomId: "room-1",
        branchId: "branch-1",
        status: ReservationStatus.CHECKED_IN,
      };
      const after = { ...reservation, status: ReservationStatus.CHECKED_OUT };
      mockPrisma.reservation.findFirst
        .mockResolvedValueOnce(reservation)
        .mockResolvedValueOnce(after);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.checkOut("res-1", "branch-1");

      expect(result).toEqual(after);
    });

    it("emits room DIRTY status via realtime", async () => {
      const reservation = {
        id: "res-1",
        roomId: "room-1",
        branchId: "branch-1",
        status: ReservationStatus.CHECKED_IN,
      };
      mockPrisma.reservation.findFirst
        .mockResolvedValueOnce(reservation)
        .mockResolvedValueOnce(reservation);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      await service.checkOut("res-1", "branch-1");

      expect(mockRealtime.emitRoomStatus).toHaveBeenCalledWith(
        "branch-1",
        "room-1",
        RoomStatus.DIRTY,
      );
    });
  });

  describe("cancelReservation", () => {
    it("updates reservation status to CANCELLED", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: "res-1",
        branchId: "branch-1",
        status: ReservationStatus.CONFIRMED,
      });
      const cancelled = {
        id: "res-1",
        status: ReservationStatus.CANCELLED,
      };
      mockPrisma.reservation.update.mockResolvedValue(cancelled);

      const result = await service.cancelReservation("res-1", "branch-1");

      expect(result).toEqual(cancelled);
      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: "res-1" },
        data: { status: ReservationStatus.CANCELLED },
        include: { guest: true, room: { include: { roomType: true } } },
      });
    });
  });

  describe("listBranches", () => {
    it("queries branches by organizationId", async () => {
      mockPrisma.branch.findMany.mockResolvedValue([]);
      await service.listBranches("org-1");
      expect(mockPrisma.branch.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
      });
    });
  });

  describe("listRooms", () => {
    it("queries rooms with roomType included", async () => {
      mockPrisma.room.findMany.mockResolvedValue([]);
      await service.listRooms("branch-1");
      expect(mockPrisma.room.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        include: { roomType: true },
        orderBy: { roomNumber: "asc" },
      });
    });
  });
});

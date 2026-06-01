import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ReservationStatus, RoomStatus } from "@erp/types";
import { PmsService } from "./pms.service";
import { PrismaService } from "../prisma/prisma.service";
import { AvailabilityService } from "./availability.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InclusionsService } from "../inclusions/inclusions.service";
import { AuditService } from "../audit/audit.service";
import { RatePricingService } from "./rate-pricing.service";

const mockPrisma = {
  branch: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
  roomType: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  room: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  guest: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), delete: jest.fn(), count: jest.fn() },
  reservation: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
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

const mockInclusions = {
  assertPackageInOrg: jest.fn().mockResolvedValue(undefined),
};

describe("PmsService", () => {
  let service: PmsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.branch.findUnique.mockResolvedValue({ organizationId: "org-1" });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PmsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AvailabilityService, useValue: mockAvailability },
        { provide: RealtimeGateway, useValue: mockRealtime },
        { provide: EventEmitter2, useValue: mockEvents },
        { provide: InclusionsService, useValue: mockInclusions },
        { provide: AuditService, useValue: { record: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: RatePricingService,
          useValue: {
            quoteStay: jest.fn().mockResolvedValue({
              totalAmount: 7000,
              nights: 2,
              ratePlanId: null,
              ratePlanName: null,
              nightlyBreakdown: [],
            }),
          },
        },
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
          adultCount: 1,
          childCount: 0,
          packageId: null,
          mealsPerGuestPerNightOverride: null,
          ratePlanId: null,
        },
        include: { guest: true, room: { include: { roomType: true } }, package: true },
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
        include: { guest: true, room: { include: { roomType: true } }, package: true },
      });
    });
  });

  describe("confirmReservation", () => {
    it("throws when reservation is not INQUIRY", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: "res-1",
        branchId: "branch-1",
        status: ReservationStatus.CONFIRMED,
        roomId: "room-1",
        checkIn: new Date("2026-06-01"),
        checkOut: new Date("2026-06-03"),
        guest: {},
        room: { roomType: {} },
      });

      await expect(
        service.confirmReservation("branch-1", "res-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("confirms inquiry when room is available", async () => {
      const reservation = {
        id: "res-1",
        branchId: "branch-1",
        status: ReservationStatus.INQUIRY,
        roomId: "room-1",
        checkIn: new Date("2026-06-01"),
        checkOut: new Date("2026-06-03"),
        guest: {},
        room: { roomType: {} },
      };
      mockPrisma.reservation.findFirst.mockResolvedValue(reservation);
      mockAvailability.findAvailableRooms.mockResolvedValue([{ id: "room-1" }]);
      const confirmed = { ...reservation, status: ReservationStatus.CONFIRMED };
      mockPrisma.reservation.update.mockResolvedValue(confirmed);

      const result = await service.confirmReservation("branch-1", "res-1");

      expect(result.status).toBe(ReservationStatus.CONFIRMED);
      expect(mockAvailability.findAvailableRooms).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: "branch-1",
          excludeReservationId: "res-1",
        }),
      );
    });
  });

  describe("updateReservation", () => {
    it("throws when reservation is checked out", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: "res-1",
        branchId: "branch-1",
        status: ReservationStatus.CHECKED_OUT,
        guest: {},
        room: { roomType: {} },
      });

      await expect(
        service.updateReservation("branch-1", "res-1", { totalAmount: 100 }),
      ).rejects.toThrow("Cannot update a closed reservation");
    });

    it("throws when checked-in and changing guest", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: "res-1",
        branchId: "branch-1",
        status: ReservationStatus.CHECKED_IN,
        guestId: "g-1",
        roomId: "room-1",
        checkIn: new Date("2026-06-01"),
        checkOut: new Date("2026-06-03"),
        guest: {},
        room: { roomType: {} },
      });

      await expect(
        service.updateReservation("branch-1", "res-1", { guestId: "g-2" }),
      ).rejects.toThrow("Checked-in reservations can only update");
    });

    it("updates confirmed reservation when room stays available", async () => {
      const reservation = {
        id: "res-1",
        branchId: "branch-1",
        status: ReservationStatus.CONFIRMED,
        guestId: "g-1",
        roomId: "room-1",
        checkIn: new Date("2026-06-01"),
        checkOut: new Date("2026-06-03"),
        guest: {},
        room: { roomType: {} },
      };
      mockPrisma.reservation.findFirst.mockResolvedValue(reservation);
      mockAvailability.findAvailableRooms.mockResolvedValue([{ id: "room-2" }]);
      mockPrisma.reservation.update.mockResolvedValue({
        ...reservation,
        roomId: "room-2",
      });

      await service.updateReservation("branch-1", "res-1", { roomId: "room-2" });

      expect(mockPrisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "res-1" },
          data: expect.objectContaining({ roomId: "room-2" }),
        }),
      );
    });
  });

  describe("deleteGuest", () => {
    it("throws when guest has active reservations", async () => {
      mockPrisma.guest.findFirst.mockResolvedValue({ id: "gst-1" });
      mockPrisma.reservation.count.mockResolvedValue(2);

      await expect(service.deleteGuest("org-1", "gst-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("deletes guest without active reservations", async () => {
      mockPrisma.guest.findFirst.mockResolvedValue({ id: "gst-1" });
      mockPrisma.reservation.count.mockResolvedValue(0);
      mockPrisma.guest.delete.mockResolvedValue({ id: "gst-1" });

      await service.deleteGuest("org-1", "gst-1");

      expect(mockPrisma.guest.delete).toHaveBeenCalledWith({
        where: { id: "gst-1" },
      });
    });
  });

  describe("updateRoomStatus", () => {
    it("throws when housekeeping tries to set OCCUPIED", async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: "rm-1",
        branchId: "branch-1",
        status: RoomStatus.VACANT,
        roomType: {},
      });

      await expect(
        service.updateRoomStatus("branch-1", "rm-1", RoomStatus.OCCUPIED),
      ).rejects.toThrow("Use check-in to mark a room occupied");
    });

    it("allows DIRTY to VACANT and emits realtime", async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: "rm-1",
        branchId: "branch-1",
        status: RoomStatus.DIRTY,
        roomType: {},
      });
      mockPrisma.room.update.mockResolvedValue({
        id: "rm-1",
        status: RoomStatus.VACANT,
        roomType: {},
      });

      await service.updateRoomStatus("branch-1", "rm-1", RoomStatus.VACANT);

      expect(mockRealtime.emitRoomStatus).toHaveBeenCalledWith(
        "branch-1",
        "rm-1",
        RoomStatus.VACANT,
      );
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

  describe("deleteRoomType", () => {
    it("throws when room type is in use", async () => {
      mockPrisma.roomType.findFirst.mockResolvedValue({ id: "rt-1" });
      mockPrisma.room.count.mockResolvedValue(1);

      await expect(service.deleteRoomType("org-1", "rt-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("deletes unused room type", async () => {
      mockPrisma.roomType.findFirst.mockResolvedValue({ id: "rt-1" });
      mockPrisma.room.count.mockResolvedValue(0);
      mockPrisma.roomType.delete.mockResolvedValue({ id: "rt-1" });

      await service.deleteRoomType("org-1", "rt-1");

      expect(mockPrisma.roomType.delete).toHaveBeenCalledWith({
        where: { id: "rt-1" },
      });
    });
  });

  describe("deleteRoom", () => {
    it("throws when room is occupied", async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: "rm-1",
        branchId: "branch-1",
        status: RoomStatus.OCCUPIED,
        roomType: {},
      });

      await expect(service.deleteRoom("branch-1", "rm-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("deletes vacant room without active reservations", async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: "rm-1",
        branchId: "branch-1",
        status: RoomStatus.VACANT,
        roomType: {},
      });
      mockPrisma.reservation.count.mockResolvedValue(0);
      mockPrisma.room.delete.mockResolvedValue({ id: "rm-1" });

      await service.deleteRoom("branch-1", "rm-1");

      expect(mockPrisma.room.delete).toHaveBeenCalledWith({ where: { id: "rm-1" } });
    });
  });

  describe("deleteReservation", () => {
    it("throws when checked in", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: "res-1",
        branchId: "branch-1",
        status: ReservationStatus.CHECKED_IN,
        guest: {},
        room: { roomType: {} },
      });

      await expect(service.deleteReservation("branch-1", "res-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("deletes cancelled reservation", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: "res-1",
        branchId: "branch-1",
        status: ReservationStatus.CANCELLED,
        guest: {},
        room: { roomType: {} },
      });
      mockPrisma.reservation.delete.mockResolvedValue({ id: "res-1" });

      await service.deleteReservation("branch-1", "res-1");

      expect(mockPrisma.reservation.delete).toHaveBeenCalledWith({
        where: { id: "res-1" },
      });
    });
  });

  describe("recordPayment", () => {
    it("emits reservation.payment_recorded for payment delta", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: "res-1",
        branchId: "branch-1",
        totalAmount: 1000,
        paidAmount: 200,
        guest: {},
        room: { roomType: {} },
      });
      mockPrisma.branch.findUnique.mockResolvedValue({ organizationId: "org-1" });
      mockPrisma.reservation.update.mockResolvedValue({ id: "res-1" });

      await service.recordPayment("branch-1", "res-1", 500);

      expect(mockEvents.emit).toHaveBeenCalledWith(
        "reservation.payment_recorded",
        expect.objectContaining({
          organizationId: "org-1",
          reservationId: "res-1",
          deltaPaid: 300,
        }),
      );
    });
  });

  describe("checkOut folio", () => {
    it("emits reservation.checked_out when balance remains", async () => {
      mockPrisma.reservation.findFirst
        .mockResolvedValueOnce({
          id: "res-1",
          branchId: "branch-1",
          roomId: "rm-1",
          status: ReservationStatus.CHECKED_IN,
          totalAmount: 1000,
          paidAmount: 400,
          guest: {},
          room: { roomType: {} },
        })
        .mockResolvedValueOnce({
          id: "res-1",
          status: ReservationStatus.CHECKED_OUT,
          guest: {},
          room: { roomType: {} },
        });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);
      mockPrisma.branch.findUnique.mockResolvedValue({ organizationId: "org-1" });

      await service.checkOut("res-1", "branch-1");

      expect(mockEvents.emit).toHaveBeenCalledWith(
        "reservation.checked_out",
        expect.objectContaining({
          organizationId: "org-1",
          reservationId: "res-1",
          unpaidAmount: 600,
        }),
      );
    });
  });
});

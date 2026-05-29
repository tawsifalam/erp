import type { ReservationStatus, RoomStatus } from "./enums";

export interface CreateBranchDto {
  name: string;
  timezone: string;
}

export interface CreateRoomTypeDto {
  name: string;
  maxAdults: number;
  maxChildren: number;
}

export interface CreateRoomDto {
  roomTypeId: string;
  roomNumber: string;
  basePrice: number;
  status?: RoomStatus;
}

export interface CreateGuestDto {
  fullName: string;
  phone?: string;
  email?: string;
}

export interface CreateReservationDto {
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  status?: ReservationStatus;
}

export interface AvailabilityQuery {
  branchId: string;
  checkIn: string;
  checkOut: string;
  roomTypeId?: string;
}

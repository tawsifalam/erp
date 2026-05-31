export type RoomType = {
  id: string;
  name: string;
  maxAdults: number;
  maxChildren: number;
};

export type Room = {
  id: string;
  roomNumber: string;
  status: string;
  basePrice: string;
  roomType: RoomType;
};

export type Guest = {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
};

export type Reservation = {
  id: string;
  status: string;
  checkIn: string;
  checkOut: string;
  totalAmount: string;
  paidAmount: string;
  adultCount?: number;
  childCount?: number;
  packageId?: string | null;
  mealsPerGuestPerNightOverride?: number | null;
  package?: { id: string; name: string } | null;
  guest: { fullName: string; id?: string };
  room: { roomNumber: string; id?: string; roomType?: { name: string } };
};

export type InclusionPackageOption = {
  id: string;
  name: string;
  isDefault: boolean;
};

export const RESERVATION_STATUSES = [
  "INQUIRY",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
] as const;

export const ROOM_STATUSES = ["VACANT", "OCCUPIED", "DIRTY", "MAINTENANCE"] as const;

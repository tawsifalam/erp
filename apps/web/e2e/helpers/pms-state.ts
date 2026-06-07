/** Mutable PMS state for Playwright route mocks (reset per test via resetPmsState). */

import { recordAudit } from "./audit-state";
import { quoteStay } from "./rates-state";
const MOCK_ORG_A = "org-test-001";
const MOCK_ORG_B = "org-test-002";
const MOCK_BRANCH_A1 = "branch-test-001";
const MOCK_BRANCH_A2 = "branch-test-002";
const MOCK_BRANCH_B1 = "branch-test-003";

export type MockReservation = {
  id: string;
  status: string;
  checkIn: string;
  checkOut: string;
  totalAmount: string;
  paidAmount: string;
  guestId: string;
  roomId: string;
  guest: { fullName: string; id?: string };
  room: { roomNumber: string; id?: string; roomType?: { name: string } };
};

export type MockRoom = {
  id: string;
  roomNumber: string;
  status: string;
  basePrice: string;
  roomTypeId: string;
  branchId: string;
  organizationId: string;
  roomType: { name: string; id?: string };
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const INITIAL_RESERVATIONS: MockReservation[] = [
  {
    id: "res-001",
    status: "CHECKED_IN",
    checkIn: "2026-05-28T14:00:00Z",
    checkOut: "2026-05-31T11:00:00Z",
    totalAmount: "10500",
    paidAmount: "10500",
    guestId: "gst_001",
    roomId: "rm_101",
    guest: { fullName: "Rahim Ahmed", id: "gst_001" },
    room: { roomNumber: "101", id: "rm_101", roomType: { name: "Standard Double" } },
  },
  {
    id: "res-002",
    status: "CONFIRMED",
    checkIn: "2026-05-30T14:00:00Z",
    checkOut: "2026-06-02T11:00:00Z",
    totalAmount: "16500",
    paidAmount: "5000",
    guestId: "gst_002",
    roomId: "rm_204",
    guest: { fullName: "Fatima Khan", id: "gst_002" },
    room: { roomNumber: "204", id: "rm_204", roomType: { name: "Deluxe Suite" } },
  },
  {
    id: "res-inquiry",
    status: "INQUIRY",
    checkIn: "2026-06-10T14:00:00Z",
    checkOut: "2026-06-12T11:00:00Z",
    totalAmount: "7000",
    paidAmount: "0",
    guestId: "gst_001",
    roomId: "rm_102",
    guest: { fullName: "Rahim Ahmed", id: "gst_001" },
    room: { roomNumber: "102", id: "rm_102", roomType: { name: "Standard Double" } },
  },
  {
    id: "res-a2-001",
    status: "CONFIRMED",
    checkIn: "2026-06-15T14:00:00Z",
    checkOut: "2026-06-17T11:00:00Z",
    totalAmount: "7600",
    paidAmount: "0",
    guestId: "gst_002",
    roomId: "rm_a2_201",
    guest: { fullName: "Fatima Khan", id: "gst_002" },
    room: { roomNumber: "201", id: "rm_a2_201", roomType: { name: "Standard Double" } },
  },
];

const INITIAL_ROOMS: MockRoom[] = [
  {
    id: "rm_101",
    roomNumber: "101",
    status: "OCCUPIED",
    basePrice: "3500",
    roomTypeId: "rt_001",
    branchId: MOCK_BRANCH_A1,
    organizationId: MOCK_ORG_A,
    roomType: { name: "Standard Double", id: "rt_001" },
  },
  {
    id: "rm_204",
    roomNumber: "204",
    status: "OCCUPIED",
    basePrice: "5500",
    roomTypeId: "rt_002",
    branchId: MOCK_BRANCH_A1,
    organizationId: MOCK_ORG_A,
    roomType: { name: "Deluxe Suite", id: "rt_002" },
  },
  {
    id: "rm_102",
    roomNumber: "102",
    status: "VACANT",
    basePrice: "3500",
    roomTypeId: "rt_001",
    branchId: MOCK_BRANCH_A1,
    organizationId: MOCK_ORG_A,
    roomType: { name: "Standard Double", id: "rt_001" },
  },
  {
    id: "rm_a2_201",
    roomNumber: "201",
    status: "VACANT",
    basePrice: "3800",
    roomTypeId: "rt_001",
    branchId: MOCK_BRANCH_A2,
    organizationId: MOCK_ORG_A,
    roomType: { name: "Standard Double", id: "rt_001" },
  },
  {
    id: "rm_b_101",
    roomNumber: "B-101",
    status: "VACANT",
    basePrice: "4000",
    roomTypeId: "rt_001",
    branchId: MOCK_BRANCH_B1,
    organizationId: MOCK_ORG_B,
    roomType: { name: "Standard Double", id: "rt_001" },
  },
];

export type MockRoomType = {
  id: string;
  organizationId: string;
  name: string;
  maxAdults: number;
  maxChildren: number;
};

export type MockGuest = {
  id: string;
  organizationId: string;
  fullName: string;
  phone?: string;
  email?: string;
};

const INITIAL_ROOM_TYPES: MockRoomType[] = [
  {
    id: "rt_001",
    organizationId: MOCK_ORG_A,
    name: "Standard Double",
    maxAdults: 2,
    maxChildren: 1,
  },
  {
    id: "rt_002",
    organizationId: MOCK_ORG_A,
    name: "Deluxe Suite",
    maxAdults: 3,
    maxChildren: 2,
  },
  {
    id: "rt_003",
    organizationId: MOCK_ORG_A,
    name: "Economy Single",
    maxAdults: 1,
    maxChildren: 0,
  },
  {
    id: "rt_b_001",
    organizationId: MOCK_ORG_B,
    name: "Harbor Standard",
    maxAdults: 2,
    maxChildren: 1,
  },
];

const INITIAL_GUESTS: MockGuest[] = [
  {
    id: "gst_001",
    organizationId: MOCK_ORG_A,
    fullName: "Rahim Ahmed",
    phone: "+8801711000001",
  },
  {
    id: "gst_002",
    organizationId: MOCK_ORG_A,
    fullName: "Fatima Khan",
    phone: "+8801711000002",
  },
  {
    id: "gst_003",
    organizationId: MOCK_ORG_A,
    fullName: "Karim Uddin",
    phone: "+8801711000003",
  },
  {
    id: "gst_b_001",
    organizationId: MOCK_ORG_B,
    fullName: "Harbor Guest",
    phone: "+8801711000099",
  },
];

let reservations = clone(INITIAL_RESERVATIONS);
let rooms = clone(INITIAL_ROOMS);
let roomTypes = clone(INITIAL_ROOM_TYPES);
let guests = clone(INITIAL_GUESTS);

export function resetPmsState() {
  reservations = clone(INITIAL_RESERVATIONS);
  rooms = clone(INITIAL_ROOMS);
  roomTypes = clone(INITIAL_ROOM_TYPES);
  guests = clone(INITIAL_GUESTS);
}

export function getPmsReservations(organizationId?: string, branchId?: string) {
  let rows = reservations;
  if (organizationId) {
    const orgRoomIds = new Set(
      rooms.filter((r) => r.organizationId === organizationId).map((r) => r.id),
    );
    rows = rows.filter((r) => orgRoomIds.has(r.roomId));
  }
  if (branchId) {
    const branchRoomIds = new Set(
      rooms.filter((r) => r.branchId === branchId).map((r) => r.id),
    );
    rows = rows.filter((r) => branchRoomIds.has(r.roomId));
  }
  return rows;
}

export function getPmsRooms(branchId?: string) {
  const rows = rooms.map((r) => ({ ...r }));
  if (!branchId) return rows;
  return rows.filter((r) => r.branchId === branchId);
}

export function getPmsRoomTypes(organizationId?: string) {
  const rows = roomTypes.map((rt) => ({ ...rt }));
  if (!organizationId) return rows;
  return rows.filter((rt) => rt.organizationId === organizationId);
}

export function getPmsGuests(organizationId?: string) {
  const rows = guests.map((g) => ({ ...g }));
  if (!organizationId) return rows;
  return rows.filter((g) => g.organizationId === organizationId);
}

export function handlePmsRoomTypeMutation(
  method: string,
  url: string,
  organizationId?: string,
): unknown {
  const idMatch = url.match(/\/room-types\/([^/?]+)/);
  const id = idMatch?.[1];
  if (!id) return {};

  const rt = roomTypes.find((r) => r.id === id);
  if (organizationId && rt && rt.organizationId !== organizationId) {
    return { status: 404, message: "Room type not found" };
  }

  if (method === "DELETE") {
    if (!rt) return { status: 404, message: "Room type not found" };
    const idx = roomTypes.findIndex((row) => row.id === id);
    if (idx >= 0) roomTypes.splice(idx, 1);
    return { id };
  }

  return rt ?? {};
}

export function handlePmsGuestMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
  organizationId?: string,
): unknown {
  const idMatch = url.match(/\/guests\/([^/?]+)/);
  const id = idMatch?.[1];

  if (method === "POST") {
    const guest: MockGuest = {
      id: "gst-new",
      organizationId: organizationId ?? MOCK_ORG_A,
      fullName: String(body?.fullName ?? "New Guest"),
      phone: body?.phone ? String(body.phone) : undefined,
      email: body?.email ? String(body.email) : undefined,
    };
    guests.push(guest);
    return guest;
  }

  if (!id) return {};

  const guest = guests.find((g) => g.id === id);
  if (!guest || (organizationId && guest.organizationId !== organizationId)) {
    return { status: 404, message: "Guest not found" };
  }

  if (method === "DELETE") {
    const idx = guests.findIndex((g) => g.id === id);
    if (idx >= 0) guests.splice(idx, 1);
    return { id };
  }

  if (method === "PATCH" && body) {
    if (body.fullName) guest.fullName = String(body.fullName);
    if (body.phone !== undefined) guest.phone = String(body.phone);
    if (body.email !== undefined) guest.email = String(body.email);
  }

  return guest;
}

function scopedReservationOrError(
  reservationId: string,
  organizationId?: string,
  branchId?: string,
): MockReservation | { status: number; message: string } {
  const res = reservations.find((r) => r.id === reservationId);
  if (!res) return { status: 404, message: "Reservation not found" };
  const room = rooms.find((r) => r.id === res.roomId);
  if (!room) return { status: 404, message: "Reservation not found" };
  if (organizationId && room.organizationId !== organizationId) {
    return { status: 404, message: "Reservation not found" };
  }
  if (branchId && room.branchId !== branchId) {
    return { status: 404, message: "Reservation not found" };
  }
  return res;
}

export function handlePmsReservationMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
  organizationId?: string,
  branchId?: string,
): unknown {
  const idMatch = url.match(/\/reservations\/([^/?]+)/);
  const id = idMatch?.[1];

  if (method === "POST" && !id) {
    const guestId = String(body?.guestId ?? "");
    const guestRecord = guests.find((g) => g.id === guestId);
    if (!guestRecord || (organizationId && guestRecord.organizationId !== organizationId)) {
      return { status: 404, message: "Guest not found" };
    }
    const roomId = String(body?.roomId ?? "");
    const roomScoped = scopedRoomOrError(roomId, organizationId, branchId);
    if ("status" in roomScoped) return roomScoped;
    const room = roomScoped;

    let total: number | undefined =
      body?.totalAmount != null ? Number(body.totalAmount) : undefined;
    if (body?.checkIn && body?.checkOut) {
      const q = quoteStay(
        room,
        new Date(String(body.checkIn)),
        new Date(String(body.checkOut)),
        Number(body?.adultCount ?? 1),
        Number(body?.childCount ?? 0),
      );
      total = total ?? q.totalAmount;
    }
    const newRes: MockReservation = {
      id: "res-new",
      status: String(body?.status ?? "CONFIRMED"),
      checkIn: String(body?.checkIn ?? ""),
      checkOut: String(body?.checkOut ?? ""),
      totalAmount: String(total ?? 0),
      paidAmount: String(body?.paidAmount ?? "0"),
      guestId,
      roomId,
      guest: { fullName: guestRecord.fullName, id: guestId },
      room: {
        roomNumber: room.roomNumber,
        id: room.id,
        roomType: room.roomType,
      },
    };
    reservations.push(newRes);
    return newRes;
  }

  if (!id) return {};

  const scoped = scopedReservationOrError(id, organizationId, branchId);
  if ("status" in scoped) return scoped;
  const res = scoped;

  if (method === "DELETE") {
    const idx = reservations.findIndex((r) => r.id === id);
    if (idx >= 0) reservations.splice(idx, 1);
    recordAudit({
      action: "DELETE",
      entityType: "reservation",
      entityId: id,
    });
    return { id };
  }

  if (url.includes("/confirm")) {
    res.status = "CONFIRMED";
    recordAudit({
      action: "UPDATE",
      entityType: "reservation",
      entityId: id,
      metadata: { status: "CONFIRMED" },
    });
    return res;
  }
  if (url.includes("/check-out")) {
    res.status = "CHECKED_OUT";
    const room = rooms.find((r) => r.id === res.roomId);
    if (room) room.status = "DIRTY";
    recordAudit({
      action: "UPDATE",
      entityType: "reservation",
      entityId: id,
      metadata: { status: "CHECKED_OUT", roomId: res.roomId },
    });
    return res;
  }
  if (url.includes("/check-in")) {
    res.status = "CHECKED_IN";
    const room = rooms.find((r) => r.id === res.roomId);
    if (room) room.status = "OCCUPIED";
    recordAudit({
      action: "UPDATE",
      entityType: "reservation",
      entityId: id,
      metadata: { status: "CHECKED_IN", roomId: res.roomId },
    });
    return res;
  }
  if (url.includes("/cancel")) {
    res.status = "CANCELLED";
    recordAudit({
      action: "UPDATE",
      entityType: "reservation",
      entityId: id,
      metadata: { status: "CANCELLED" },
    });
    return res;
  }
  if (url.includes("/payment") && body) {
    res.paidAmount = String(body.paidAmount ?? res.paidAmount);
    return res;
  }
  if (method === "PATCH" && body) {
    if (body.guestId) {
      const nextGuestId = String(body.guestId);
      const guest = guests.find((g) => g.id === nextGuestId);
      if (!guest || (organizationId && guest.organizationId !== organizationId)) {
        return { status: 404, message: "Guest not found" };
      }
      res.guestId = nextGuestId;
      res.guest = { fullName: guest.fullName, id: nextGuestId };
    }
    if (body.roomId) {
      const nextRoomId = String(body.roomId);
      const nextRoom = scopedRoomOrError(nextRoomId, organizationId, branchId);
      if ("status" in nextRoom) return nextRoom;
      res.roomId = nextRoomId;
      res.room = {
        roomNumber: nextRoom.roomNumber,
        id: nextRoom.id,
        roomType: nextRoom.roomType,
      };
    }
    if (body.checkIn) res.checkIn = String(body.checkIn);
    if (body.checkOut) res.checkOut = String(body.checkOut);
    if (body.totalAmount != null) {
      res.totalAmount = String(body.totalAmount);
    } else if (body.checkIn || body.checkOut || body.roomId) {
      const room = rooms.find((r) => r.id === res.roomId);
      if (room) {
        const q = quoteStay(room, new Date(res.checkIn), new Date(res.checkOut));
        res.totalAmount = String(q.totalAmount);
      }
    }
    return res;
  }

  return res;
}

function scopedRoomOrError(
  id: string,
  organizationId?: string,
  branchId?: string,
): MockRoom | { status: number; message: string } {
  const room = rooms.find((r) => r.id === id);
  if (!room) return { status: 404, message: "Room not found" };
  if (organizationId && room.organizationId !== organizationId) {
    return { status: 404, message: "Room not found" };
  }
  if (branchId && room.branchId !== branchId) {
    return { status: 404, message: "Room not found" };
  }
  return room;
}

export function handlePmsRoomMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
  organizationId?: string,
  branchId?: string,
): unknown {
  const idMatch = url.match(/\/rooms\/([^/?]+)/);
  const id = idMatch?.[1];
  if (!id) return {};

  const scoped = scopedRoomOrError(id, organizationId, branchId);
  if ("status" in scoped) return scoped;

  if (method === "DELETE") {
    const idx = rooms.findIndex((r) => r.id === id);
    if (idx >= 0) rooms.splice(idx, 1);
    return { id };
  }

  const room = scoped;

  if (url.includes("/status") && body?.status) {
    room.status = String(body.status);
    return room;
  }
  if (method === "PATCH" && body) {
    if (body.roomNumber) room.roomNumber = String(body.roomNumber);
    if (body.basePrice != null) room.basePrice = String(body.basePrice);
    return room;
  }

  return room;
}

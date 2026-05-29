/** Mutable PMS state for Playwright route mocks (reset per test via resetPmsState). */

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
    roomId: "rm_101",
    guest: { fullName: "Rahim Ahmed", id: "gst_001" },
    room: { roomNumber: "101", id: "rm_101", roomType: { name: "Standard Double" } },
  },
];

const INITIAL_ROOMS: MockRoom[] = [
  {
    id: "rm_101",
    roomNumber: "101",
    status: "OCCUPIED",
    basePrice: "3500",
    roomTypeId: "rt_001",
    roomType: { name: "Standard Double", id: "rt_001" },
  },
  {
    id: "rm_204",
    roomNumber: "204",
    status: "OCCUPIED",
    basePrice: "5500",
    roomTypeId: "rt_002",
    roomType: { name: "Deluxe Suite", id: "rt_002" },
  },
  {
    id: "rm_102",
    roomNumber: "102",
    status: "VACANT",
    basePrice: "3500",
    roomTypeId: "rt_001",
    roomType: { name: "Standard Double", id: "rt_001" },
  },
];

export type MockRoomType = {
  id: string;
  name: string;
  maxAdults: number;
  maxChildren: number;
};

export type MockGuest = {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
};

const INITIAL_ROOM_TYPES: MockRoomType[] = [
  { id: "rt_001", name: "Standard Double", maxAdults: 2, maxChildren: 1 },
  { id: "rt_002", name: "Deluxe Suite", maxAdults: 3, maxChildren: 2 },
  { id: "rt_003", name: "Economy Single", maxAdults: 1, maxChildren: 0 },
];

const INITIAL_GUESTS: MockGuest[] = [
  { id: "gst_001", fullName: "Rahim Ahmed", phone: "+8801711000001" },
  { id: "gst_002", fullName: "Fatima Khan", phone: "+8801711000002" },
  { id: "gst_003", fullName: "Karim Uddin", phone: "+8801711000003" },
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

export function getPmsReservations() {
  return reservations;
}

export function getPmsRooms() {
  return rooms;
}

export function getPmsRoomTypes() {
  return roomTypes;
}

export function getPmsGuests() {
  return guests;
}

export function handlePmsRoomTypeMutation(method: string, url: string): unknown {
  const idMatch = url.match(/\/room-types\/([^/?]+)/);
  const id = idMatch?.[1];
  if (!id) return {};

  if (method === "DELETE") {
    const idx = roomTypes.findIndex((rt) => rt.id === id);
    if (idx >= 0) roomTypes.splice(idx, 1);
    return { id };
  }

  const rt = roomTypes.find((r) => r.id === id);
  return rt ?? {};
}

export function handlePmsGuestMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  const idMatch = url.match(/\/guests\/([^/?]+)/);
  const id = idMatch?.[1];

  if (method === "POST") {
    const guest: MockGuest = {
      id: "gst-new",
      fullName: String(body?.fullName ?? "New Guest"),
      phone: body?.phone ? String(body.phone) : undefined,
      email: body?.email ? String(body.email) : undefined,
    };
    guests.push(guest);
    return guest;
  }

  if (!id) return {};

  if (method === "DELETE") {
    const idx = guests.findIndex((g) => g.id === id);
    if (idx >= 0) guests.splice(idx, 1);
    return { id };
  }

  const guest = guests.find((g) => g.id === id);
  if (!guest) return {};

  if (method === "PATCH" && body) {
    if (body.fullName) guest.fullName = String(body.fullName);
    if (body.phone !== undefined) guest.phone = String(body.phone);
    if (body.email !== undefined) guest.email = String(body.email);
  }

  return guest;
}

export function handlePmsReservationMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  const idMatch = url.match(/\/reservations\/([^/?]+)/);
  const id = idMatch?.[1];

  if (method === "POST") {
    const newRes: MockReservation = {
      id: "res-new",
      status: String(body?.status ?? "CONFIRMED"),
      checkIn: String(body?.checkIn ?? ""),
      checkOut: String(body?.checkOut ?? ""),
      totalAmount: String(body?.totalAmount ?? "0"),
      paidAmount: String(body?.paidAmount ?? "0"),
      guestId: String(body?.guestId ?? ""),
      roomId: String(body?.roomId ?? ""),
      guest: { fullName: "New Guest" },
      room: { roomNumber: "102", roomType: { name: "Standard Double" } },
    };
    reservations.push(newRes);
    return newRes;
  }

  if (!id) return {};

  if (method === "DELETE") {
    const idx = reservations.findIndex((r) => r.id === id);
    if (idx >= 0) reservations.splice(idx, 1);
    return { id };
  }

  const res = reservations.find((r) => r.id === id);
  if (!res) return {};

  if (url.includes("/confirm")) {
    res.status = "CONFIRMED";
    return res;
  }
  if (url.includes("/check-in")) {
    res.status = "CHECKED_IN";
    const room = rooms.find((r) => r.id === res.roomId);
    if (room) room.status = "OCCUPIED";
    return res;
  }
  if (url.includes("/check-out")) {
    res.status = "CHECKED_OUT";
    const room = rooms.find((r) => r.id === res.roomId);
    if (room) room.status = "DIRTY";
    return res;
  }
  if (url.includes("/cancel")) {
    res.status = "CANCELLED";
    return res;
  }
  if (url.includes("/payment") && body) {
    res.paidAmount = String(body.paidAmount ?? res.paidAmount);
    return res;
  }
  if (method === "PATCH" && body) {
    if (body.guestId) res.guestId = String(body.guestId);
    if (body.roomId) {
      res.roomId = String(body.roomId);
      const room = rooms.find((r) => r.id === res.roomId);
      if (room) {
        res.room = {
          roomNumber: room.roomNumber,
          id: room.id,
          roomType: room.roomType,
        };
      }
    }
    if (body.checkIn) res.checkIn = String(body.checkIn);
    if (body.checkOut) res.checkOut = String(body.checkOut);
    if (body.totalAmount != null) res.totalAmount = String(body.totalAmount);
    return res;
  }

  return res;
}

export function handlePmsRoomMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  const idMatch = url.match(/\/rooms\/([^/?]+)/);
  const id = idMatch?.[1];
  if (!id) return {};

  if (method === "DELETE") {
    const idx = rooms.findIndex((r) => r.id === id);
    if (idx >= 0) rooms.splice(idx, 1);
    return { id };
  }

  const room = rooms.find((r) => r.id === id);
  if (!room) return {};

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

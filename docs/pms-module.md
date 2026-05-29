# PMS module reference

Property Management System: room inventory, guests, reservations, availability, housekeeping, and realtime room status.

## Scope and tenancy

| Entity        | Scoped by        | Notes |
|---------------|------------------|-------|
| Room types    | Organization     | Shared catalog across branches |
| Guests        | Organization     | Shared guest book |
| Rooms         | Branch           | Physical keys per property |
| Reservations  | Branch           | Stay tied to one branch |
| Availability  | Branch + dates   | Excludes overlapping CONFIRMED/CHECKED_IN |

All PMS routes require `Authorization`, `X-Organization-Id`, and usually `X-Branch-Id` (or `branchId` query param).

IDs use prefixes from seed/runtime: `org_`, `br_`, `rt_`, `rm_`, `gst_`, `res_`.

## Web UI (`/pms`)

Open **PMS** in the sidebar. Select **organization** and **branch** in the header first.

| Tab | Features |
|-----|----------|
| **Reservations** | List stays; create CONFIRMED/INQUIRY; **edit** (guest, dates, room, total); confirm inquiry; check-in/out; cancel; record `paidAmount`; **delete** (not while CHECKED_IN) |
| **Rooms** | List rooms; create room; **edit** room number, type, price; **delete** (not OCCUPIED / active reservations); housekeeping status buttons; live updates via Socket.IO `room.status` |
| **Room types** | Create/edit/**delete** types (`maxAdults`, `maxChildren`; delete blocked if rooms use type) |
| **Guests** | Create/edit/delete guests (delete blocked if active reservations exist) |

Branch setup (create branches) is under **Settings** (`/tenants/branches`). `POST /pms/branches` remains for API/scripts.

## Reservation lifecycle

```
INQUIRY ──confirm──► CONFIRMED ──check-in──► CHECKED_IN ──check-out──► CHECKED_OUT
   │                      │
   └──── cancel ──────────┴──── cancel ───► CANCELLED
```

- **INQUIRY**: Optional hold; does not block availability until confirmed.
- **CONFIRMED**: Blocks overlapping reservations; requires availability on create/confirm/update.
- **CHECKED_IN / CHECKED_OUT**: Terminal for stay operations; limited field updates when checked in.
- **CANCELLED**: Only from `INQUIRY` or `CONFIRMED`.

## Room status lifecycle

```
VACANT ◄── housekeeping ── DIRTY ◄── check-out ── OCCUPIED ◄── check-in ── (from CONFIRMED)
  ▲                                                      │
  └──────── MAINTENANCE ◄────────────────────────────────┘
```

- **OCCUPIED**: Set only by check-in (not housekeeping API).
- **DIRTY**: Set by check-out.
- **Housekeeping API** (`PATCH /pms/rooms/:id/status`): `DIRTY→VACANT`, `VACANT↔MAINTENANCE`.
- **MAINTENANCE** rooms are excluded from availability search.

## API reference

Base: `$BASE` = `http://localhost:3001/api`

### Room types

```bash
# List
curl -s "$BASE/pms/room-types" -H "Authorization: Bearer $TOKEN" -H "X-Organization-Id: $ORG_ID" | jq

# Create
curl -s -X POST "$BASE/pms/room-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Standard Double","maxAdults":2,"maxChildren":1}' | jq

# Update
curl -s -X PATCH "$BASE/pms/room-types/$ROOM_TYPE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Standard Twin"}' | jq

# Delete (blocked while rooms reference this type)
curl -s -X DELETE "$BASE/pms/room-types/$ROOM_TYPE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID"
```

### Delete rules

| Entity | Allowed when |
|--------|----------------|
| Room type | No rooms assigned to the type |
| Room | Not `OCCUPIED`; no INQUIRY/CONFIRMED/CHECKED_IN reservations on that room |
| Reservation | Not `CHECKED_IN` (check out first) |
| Guest | No active reservations (existing rule) |

### Rooms

```bash
# List
curl -s "$BASE/pms/rooms?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq

# Create
curl -s -X POST "$BASE/pms/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d "{\"branchId\":\"$BRANCH_ID\",\"roomTypeId\":\"$ROOM_TYPE_ID\",\"roomNumber\":\"105\",\"basePrice\":3500}" | jq

# Housekeeping status
curl -s -X PATCH "$BASE/pms/rooms/$ROOM_ID/status?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"VACANT"}' | jq

# Delete room
curl -s -X DELETE "$BASE/pms/rooms/$ROOM_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

### Guests

```bash
curl -s "$BASE/pms/guests" -H "Authorization: Bearer $TOKEN" -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/pms/guests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Tanvir Hasan","phone":"+8801712345678","email":"tanvir@example.com"}' | jq

curl -s -X PATCH "$BASE/pms/guests/$GUEST_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+8801799999999"}' | jq

curl -s -X DELETE "$BASE/pms/guests/$GUEST_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID"
```

### Availability

```bash
curl -s "$BASE/pms/availability?branchId=$BRANCH_ID&checkIn=2026-06-01T14:00:00Z&checkOut=2026-06-03T11:00:00Z&roomTypeId=$ROOM_TYPE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq
```

Optional query params: `roomTypeId`, `excludeReservationId` (when editing dates).

### Reservations

```bash
# Inquiry (no availability block until confirm)
curl -s -X POST "$BASE/pms/reservations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d "{\"branchId\":\"$BRANCH_ID\",\"guestId\":\"$GUEST_ID\",\"roomId\":\"$ROOM_ID\",\"checkIn\":\"2026-06-01T14:00:00Z\",\"checkOut\":\"2026-06-03T11:00:00Z\",\"totalAmount\":7000,\"status\":\"INQUIRY\"}" | jq

# Confirmed (availability enforced)
curl -s -X POST "$BASE/pms/reservations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d "{\"branchId\":\"$BRANCH_ID\",\"guestId\":\"$GUEST_ID\",\"roomId\":\"$ROOM_ID\",\"checkIn\":\"2026-06-01T14:00:00Z\",\"checkOut\":\"2026-06-03T11:00:00Z\",\"totalAmount\":7000,\"paidAmount\":2000}" | jq

curl -s -X PATCH "$BASE/pms/reservations/$RES_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d "{\"guestId\":\"$GUEST_ID\",\"roomId\":\"$ROOM_ID\",\"checkIn\":\"2026-06-05T14:00:00Z\",\"checkOut\":\"2026-06-07T11:00:00Z\",\"totalAmount\":8000}" | jq

curl -s -X PATCH "$BASE/pms/rooms/$ROOM_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"roomNumber":"105","basePrice":4000}' | jq

curl -s -X PATCH "$BASE/pms/reservations/$RES_ID/confirm?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X PATCH "$BASE/pms/reservations/$RES_ID/payment?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"paidAmount":7000}' | jq

curl -s -X PATCH "$BASE/pms/reservations/$RES_ID/check-in?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X PATCH "$BASE/pms/reservations/$RES_ID/check-out?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X PATCH "$BASE/pms/reservations/$RES_ID/cancel?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X DELETE "$BASE/pms/reservations/$RES_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

## Realtime

Subscribe on the web via `joinBranch(branchId)` and listen for `room.status`:

```typescript
socket.emit("join", `branch:${branchId}`);
socket.on("room.status", ({ roomId, status }) => { /* refresh UI */ });
```

Emitted on check-in, check-out, and housekeeping status changes.

## Accounting integration (folio)

When **`paidAmount` increases** on `PATCH /reservations/:id/payment`, the API emits `reservation.payment_recorded` and posts:

- **Debit** Cash (`1000`) / **Credit** Room Revenue (`4000`) for the payment **delta**

On **check-out**, if `paidAmount < totalAmount`, emits `reservation.checked_out` and posts:

- **Debit** Accounts Receivable (`1300`) / **Credit** Room Revenue (`4000`) for the **unpaid balance**

Requires chart of accounts from seed or Settings setup. If accounts are missing, payment/check-out still succeed; journal entries are skipped.

## Events

| Event | When | Payload |
|-------|------|---------|
| `reservation.checked_in` | After check-in | `{ reservationId, roomId, branchId }` |
| `reservation.payment_recorded` | Payment delta > 0 | `{ organizationId, reservationId, deltaPaid }` |
| `reservation.checked_out` | Check-out with balance due | `{ organizationId, reservationId, unpaidAmount }` |

## Dashboard metrics

`GET /reporting/dashboard` uses:

- **occupancyPct**: rooms with status `OCCUPIED` ÷ total rooms in branch
- **activeReservations**: count of `INQUIRY`, `CONFIRMED`, `CHECKED_IN` reservations

## Permissions

| Role | Access |
|------|--------|
| OWNER, ADMIN | All PMS permissions |
| FRONT_DESK | `PMS_READ`, `PMS_WRITE` |
| ACCOUNTANT, KITCHEN, etc. | No PMS write (see `packages/utils/src/rbac.ts`) |

## Testing

```bash
pnpm --filter @erp/api test -- pms
pnpm --filter @erp/api test -- pms-events.listener
pnpm --filter @erp/api test -- accounting-listeners
pnpm --filter @erp/web test:e2e pms
```

E2E coverage includes reservation lifecycle, edit modals, **delete** flows (reservations, rooms, room types, guests), and the **payment** modal (`e2e/pms-flow.spec.ts`).

## Future (phase 2)

See [channel-manager.md](./phase2/channel-manager.md) for OTA sync and `INQUIRY` import from external channels.

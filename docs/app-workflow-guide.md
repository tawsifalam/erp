# Hospitality ERP — Application Workflow Guide

> A step-by-step walkthrough of every module in the Hospitality ERP, complete with curl examples using seed data.

---

## Table of Contents

- [Quick Start](#quick-start)
- [1. Authentication & Tenant Selection](#1-authentication--tenant-selection)
- [1b. Organization & Branch Management](#1b-organization--branch-management)
- [2. Property Management System (PMS)](#2-property-management-system-pms)
- [3. Point of Sale (POS)](#3-point-of-sale-pos)
- [4. Inventory Management](#4-inventory-management)
- [5. Accounting](#5-accounting)
- [6. HR & Payroll](#6-hr--payroll)
- [7. Reporting & Dashboard](#7-reporting--dashboard)
- [8. Event-Driven Architecture](#8-event-driven-architecture)
- [9. Realtime (Socket.IO)](#9-realtime-socketio)
- [10. Testing](#10-testing)

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 15+
- Redis 7+
- Docker (optional, for infra services)

### Run the Application

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (Postgres + Redis)
docker compose up -d postgres redis

# 3. Run database migrations
cd apps/api && pnpm prisma migrate dev

# 4. Seed the database with demo data
pnpm prisma db seed

# 5. Start the dev servers (from repo root)
cd ../..
pnpm dev
```

### Default URLs

| Service  | URL                     |
|----------|-------------------------|
| Frontend | http://localhost:3000    |
| Backend  | http://localhost:3001    |
| API docs | http://localhost:3001/api|

### Seed Data Overview

The seed script creates a fully functional demo environment:

| Entity          | Count | Notes                                     |
|-----------------|------:|-------------------------------------------|
| Organization    |     1 | Boulevard Hospitality Group               |
| Branches        |     2 | Main Hotel & Restaurant, Boulevard Café   |
| Admin User      |     1 | admin@boulevard.cafe                      |
| Room Types      |     2 | Standard Double, Deluxe Suite             |
| Rooms           |     7 | 4 Standard (101-104), 3 Deluxe (201-203) |
| Guests          |     5 | Rahim, Fatima, John, Maria, Chen          |
| Reservations    |     5 | Various statuses                          |
| Accounts (CoA)  |    14 | Full chart of accounts                    |
| Menu Categories |     3 | Breakfast, Mains, Beverages               |
| Menu Items      |    10 | Biryani, Fish, Tea, Coffee, etc.          |
| Inventory Items |    12 | Rice, Chicken, Oil, Eggs, etc.            |
| Recipes (BOM)   |     8 | Linked to menu items                      |
| Employees       |     5 | Chef, Front Desk, Waiter, etc.            |

#### Key Seed IDs

```
Organization:  00000000-0000-0000-0000-000000000100  (Boulevard Hospitality Group)
Main Branch:   00000000-0000-0000-0000-000000000001  (Main Hotel & Restaurant)
Café Branch:   00000000-0000-0000-0000-000000000002  (Boulevard Café)
Admin User:    00000000-0000-0000-0000-000000000200  (admin@boulevard.cafe)

Room Types:
  Standard:    00000000-0000-0000-0000-000000000010
  Deluxe:      00000000-0000-0000-0000-000000000011

Guests:
  Rahim Ahmed: 00000000-0000-0000-0000-000000000301
  Fatima Khan: 00000000-0000-0000-0000-000000000302
  John Smith:  00000000-0000-0000-0000-000000000303
  Maria Garcia:00000000-0000-0000-0000-000000000304
  Chen Wei:    00000000-0000-0000-0000-000000000305

Employees:
  Karim Hossain (Head Chef):           00000000-0000-0000-0000-000000000401
  Nasreen Begum (Front Desk Manager):  00000000-0000-0000-0000-000000000402
  Rashid Islam (Waiter):               00000000-0000-0000-0000-000000000403
  Ayesha Rahman (Housekeeper):         00000000-0000-0000-0000-000000000404
  Tanvir Alam (Accountant):            00000000-0000-0000-0000-000000000405
```

---

## Curl Setup (Use for All Examples)

Every curl example in this guide assumes these shell variables are set:

```bash
# Set these variables before running any curl commands
TOKEN="your-propelauth-access-token"
ORG_ID="00000000-0000-0000-0000-000000000100"
BRANCH_ID="00000000-0000-0000-0000-000000000001"
BASE="http://localhost:3001"
```

---

## 1. Authentication & Tenant Selection

### How Login Works

The application uses [PropelAuth](https://www.propelauth.com/) for authentication. The flow is:

```
User clicks "Login"
  → Redirected to PropelAuth hosted login page
  → User enters credentials
  → PropelAuth redirects back to /api/auth/callback
  → Next.js stores the session
  → User lands on /dashboard
```

**Frontend** (`apps/web`): Uses `@propelauth/nextjs` with the `AuthProvider` wrapper. Login is triggered by navigating to `/api/auth/login`.

**Backend** (`apps/api`): Uses `@propelauth/node` to validate the `Authorization: Bearer <token>` header on every request via `JwtAuthGuard`.

### How Tenant Context Is Set

After authentication, the frontend must send two additional headers to identify which organization and branch the user is operating in:

| Header              | Description                                      | Required |
|---------------------|--------------------------------------------------|----------|
| `Authorization`     | `Bearer <propelauth-access-token>`               | Yes      |
| `X-Organization-Id` | The UUID of the organization                     | Yes      |
| `X-Branch-Id`       | The UUID of the branch (optional for some calls) | No*      |

*Many endpoints accept `branchId` as a query parameter instead, falling back to the header value.

The `TenantGuard` in the backend:
1. Extracts `X-Organization-Id` from the request header
2. Looks up the user's membership in that organization
3. If the user is a member, attaches a `TenantContext` to the request containing `organizationId`, `branchId`, `userId`, and `role`
4. If the user is not a member, returns `403 Forbidden`

### Permissions

Each endpoint is protected by a `PermissionGuard` with specific permissions like `PMS_READ`, `PMS_WRITE`, `POS_READ`, etc. The OWNER role (assigned to the seed admin) has all permissions.

---

## 1b. Organization & Branch Management

**New users:** After PropelAuth login, users without an ERP membership are sent to `/onboarding` to create an organization or request to join one. See [Organization onboarding](organization-onboarding.md).

Organizations and branches are the **tenant boundary** for all operational data. Every module scopes records by `organizationId` and usually by `branchId`.

### Data model

| Table            | Purpose |
|------------------|---------|
| `Organization`   | Top-level tenant (hotel group, restaurant company). Linked to PropelAuth via `propelAuthOrgId`. |
| `Branch`         | A physical property under an org (hotel, café outlet). Has `name` and IANA `timezone`. |
| `UserOrganization` | Maps a user to an org with a `Role` (OWNER, ADMIN, FRONT_DESK, …). |

Prefixed IDs (e.g. `org_…`, `br_…`) make it easy to recognize entity types in logs and support tickets.

### How modules use org & branch

```
┌─────────────────────────────────────────────────────────────┐
│  User selects Organization + Branch (header or Settings)     │
│       ↓ X-Organization-Id, X-Branch-Id on every API call     │
└─────────────────────────────────────────────────────────────┘
         │
         ├── PMS ──────── reservations, rooms, guests (branch)
         ├── POS ──────── orders, menu (branch)
         ├── Inventory ─ items, movements (branch)
         ├── Accounting ─ accounts, journals (organization)
         ├── HR ───────── employees (org; optional branch)
         └── Reporting ─ dashboard metrics (org + branch)
```

- **Organization-scoped**: chart of accounts, employees, payroll runs, journal entries, guests (org-wide guest book).
- **Branch-scoped**: rooms, reservations, inventory, POS orders, attendance clock-in branch.

If you change branch in the header, PMS/POS/Inventory pages reload data for that branch. Accounting and HR stay at organization level.

### Web UI: Settings page

Open **Settings** (`/settings`) in the sidebar (OWNER / ADMIN only for management actions).

| Action | What it does |
|--------|----------------|
| **Create organization** | Inserts `Organization`, default branch "Main Branch", and `UserOrganization` as OWNER. |
| **Rename organization** | Updates display `name` in the local database. |
| **Add branch** | Creates a new `Branch` under the current organization. |
| **Edit branch** | Updates branch `name` and `timezone`. |
| **Team & access** | Approve join requests (with role), manage members, copy join code. |
| **Inventory pools** | View/edit guest & staff pools; add custom pools (codes as text slugs). |

After changes, the app refreshes memberships so the header **Organization / Branch** dropdowns stay in sync.

### API: Tenant management (`/api/tenants`)

Requires `Authorization` and, for branch/org updates, `X-Organization-Id`. Management endpoints require `admin:*` permission (OWNER / ADMIN roles).

**List memberships (used by header selectors):**

```bash
curl -s "$BASE/tenants/organizations" \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Get current organization (with branches):**

```bash
curl -s "$BASE/tenants/organizations/current" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

**Rename current organization:**

```bash
curl -s -X PATCH "$BASE/tenants/organizations/current" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Boulevard Hospitality Group"}' | jq
```

**List branches:**

```bash
curl -s "$BASE/tenants/branches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

**Create branch:**

```bash
curl -s -X POST "$BASE/tenants/branches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Boulevard Café","timezone":"Asia/Dhaka"}' | jq
```

**Update branch:**

```bash
curl -s -X PATCH "$BASE/tenants/branches/$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Main Hotel & Restaurant","timezone":"Asia/Dhaka"}' | jq
```

**Create organization (new tenant + default branch + OWNER membership):**

```bash
curl -s -X POST "$BASE/tenants/organizations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Property Co","timezone":"Asia/Dhaka"}' | jq
```

> **Auth sync:** `POST /auth/sync` upserts the ERP user only. Organization membership comes from onboarding (create org or approved join request), not from PropelAuth org JWT. See [Organization onboarding](organization-onboarding.md).

### PMS overlap

`POST /api/pms/branches` still exists for users with `pms:write` and creates a branch the same way. Prefer **`/api/tenants/branches`** for admin setup so all tenant CRUD lives under `/tenants`.

---

## 2. Property Management System (PMS)

The PMS module handles room types, rooms, guests, reservations, availability, housekeeping, and realtime room status per branch.

> **Full reference:** [docs/pms-module.md](pms-module.md) — API tables, Web UI tabs, state machines, payments, and testing.

### Web UI (`/pms`)

After selecting **organization** and **branch** in the header, open **PMS** in the sidebar:

| Tab | Features |
|-----|----------|
| **Reservations** | List stays; create CONFIRMED/INQUIRY; **edit** (guest, dates, room, total); confirm inquiry; check-in/out; cancel; record `paidAmount` via Payment modal; **delete** (not while CHECKED_IN) |
| **Rooms** | List rooms; create room; **edit** room number, type, price; **delete** (not OCCUPIED / active reservations); housekeeping status buttons; live updates via Socket.IO `room.status` |
| **Room types** | Create/edit/**delete** types (`maxAdults`, `maxChildren`; delete blocked if rooms use type) |
| **Guests** | Create/edit/**delete** guests (delete blocked if active reservations exist) |

Branch creation is under **Settings** (`/tenants/branches`). Use `POST /pms/branches` only for API/scripts.

### Step 1: List Branches

```bash
curl -s "$BASE/pms/branches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

**Expected response:**
```json
[
  {
    "id": "00000000-0000-0000-0000-000000000001",
    "organizationId": "00000000-0000-0000-0000-000000000100",
    "name": "Main Hotel & Restaurant",
    "timezone": "Asia/Dhaka"
  },
  {
    "id": "00000000-0000-0000-0000-000000000002",
    "organizationId": "00000000-0000-0000-0000-000000000100",
    "name": "Boulevard Café",
    "timezone": "Asia/Dhaka"
  }
]
```

### Step 2: Room Types (list and create)

```bash
curl -s "$BASE/pms/room-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/pms/room-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Standard Double","maxAdults":2,"maxChildren":1}' | jq

# Delete room type (blocked while rooms reference it)
curl -s -X DELETE "$BASE/pms/room-types/$ROOM_TYPE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

**Expected response:**
```json
[
  {
    "id": "00000000-0000-0000-0000-000000000010",
    "organizationId": "00000000-0000-0000-0000-000000000100",
    "name": "Standard Double",
    "maxAdults": 2,
    "maxChildren": 1
  },
  {
    "id": "00000000-0000-0000-0000-000000000011",
    "organizationId": "00000000-0000-0000-0000-000000000100",
    "name": "Deluxe Suite",
    "maxAdults": 3,
    "maxChildren": 2
  }
]
```

### Step 3: Rooms (list, create, housekeeping)

```bash
curl -s "$BASE/pms/rooms?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq

curl -s -X POST "$BASE/pms/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d "{\"branchId\":\"$BRANCH_ID\",\"roomTypeId\":\"$ROOM_TYPE_ID\",\"roomNumber\":\"105\",\"basePrice\":3500}" | jq

# Mark room clean after housekeeping
curl -s -X PATCH "$BASE/pms/rooms/$ROOM_ID/status?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"VACANT"}' | jq

# Edit room
curl -s -X PATCH "$BASE/pms/rooms/$ROOM_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"roomNumber":"105","basePrice":4000}' | jq

# Delete room (not OCCUPIED; no active reservations)
curl -s -X DELETE "$BASE/pms/rooms/$ROOM_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

**Expected response (abridged):**
```json
[
  {
    "id": "...",
    "branchId": "00000000-0000-0000-0000-000000000001",
    "roomNumber": "101",
    "status": "OCCUPIED",
    "basePrice": "3500",
    "roomType": { "name": "Standard Double", "maxAdults": 2, "maxChildren": 1 }
  },
  {
    "id": "...",
    "roomNumber": "102",
    "status": "VACANT",
    "basePrice": "3500",
    "roomType": { "name": "Standard Double" }
  },
  {
    "id": "...",
    "roomNumber": "201",
    "status": "VACANT",
    "basePrice": "6000",
    "roomType": { "name": "Deluxe Suite" }
  }
]
```

### Step 4: Create a Guest

```bash
curl -s -X POST "$BASE/pms/guests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Tanvir Hasan",
    "phone": "+8801712345678",
    "email": "tanvir@example.com"
  }' | jq
```

**Expected response:**
```json
{
  "id": "a1b2c3d4-...",
  "organizationId": "00000000-0000-0000-0000-000000000100",
  "fullName": "Tanvir Hasan",
  "phone": "+8801712345678",
  "email": "tanvir@example.com"
}
```

```bash
# Delete guest (blocked while INQUIRY/CONFIRMED/CHECKED_IN reservations exist)
curl -s -X DELETE "$BASE/pms/guests/$GUEST_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

### Step 5: Check Room Availability

Optional: `roomTypeId`, `excludeReservationId` (when changing dates on an existing booking).

```bash
curl -s "$BASE/pms/availability?branchId=$BRANCH_ID&checkIn=2026-06-01T14:00:00Z&checkOut=2026-06-03T11:00:00Z" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq
```

**Expected response:** An array of available rooms for those dates.

```json
[
  {
    "id": "room-uuid-102",
    "roomNumber": "102",
    "status": "VACANT",
    "basePrice": "3500",
    "roomType": { "name": "Standard Double" }
  },
  {
    "id": "room-uuid-201",
    "roomNumber": "201",
    "basePrice": "6000",
    "roomType": { "name": "Deluxe Suite" }
  }
]
```

### Step 6: Create a Reservation

Use the guest ID from Step 4 and a room ID from Step 5:

```bash
GUEST_ID="00000000-0000-0000-0000-000000000301"   # Rahim Ahmed (seed)
ROOM_ID="<room-uuid-from-availability>"

curl -s -X POST "$BASE/pms/reservations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchId\": \"$BRANCH_ID\",
    \"guestId\": \"$GUEST_ID\",
    \"roomId\": \"$ROOM_ID\",
    \"checkIn\": \"2026-06-01T14:00:00Z\",
    \"checkOut\": \"2026-06-03T11:00:00Z\",
    \"totalAmount\": 7000
  }" | jq
```

**Expected response:**
```json
{
  "id": "new-reservation-uuid",
  "branchId": "00000000-0000-0000-0000-000000000001",
  "guestId": "00000000-0000-0000-0000-000000000301",
  "roomId": "room-uuid",
  "checkIn": "2026-06-01T14:00:00.000Z",
  "checkOut": "2026-06-03T11:00:00.000Z",
  "totalAmount": "7000",
  "status": "CONFIRMED",
  "guest": { "fullName": "Rahim Ahmed" },
  "room": { "roomNumber": "102" }
}
```

### Step 7: Check-In

```bash
RESERVATION_ID="<reservation-uuid>"

curl -s -X PATCH "$BASE/pms/reservations/$RESERVATION_ID/check-in" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq
```

**What happens:**
1. Reservation status changes: `CONFIRMED` → `CHECKED_IN`
2. Room status changes: `VACANT` → `OCCUPIED`
3. Event `reservation.checked_in` is emitted
4. Socket.IO broadcasts `room.status` to `branch:<branchId>` room

### Step 8: Check-Out

```bash
curl -s -X PATCH "$BASE/pms/reservations/$RESERVATION_ID/check-out" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq
```

**What happens:**
1. Reservation status changes: `CHECKED_IN` → `CHECKED_OUT`
2. Room status changes: `OCCUPIED` → `DIRTY`
3. Socket.IO broadcasts `room.status` update

### Step 9: Cancel a Reservation

```bash
curl -s -X PATCH "$BASE/pms/reservations/$RESERVATION_ID/cancel" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq
```

**What happens:** Reservation status changes to `CANCELLED` (only from `INQUIRY` or `CONFIRMED`).

### Step 10: Confirm inquiry and record payment

```bash
curl -s -X PATCH "$BASE/pms/reservations/$RESERVATION_ID/confirm?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X PATCH "$BASE/pms/reservations/$RESERVATION_ID/payment?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"paidAmount":7000}' | jq
```

Create inquiries with `"status":"INQUIRY"` on `POST /pms/reservations` — they do not block availability until confirmed.

### Step 11: Edit and delete reservations

```bash
# Edit guest, dates, room, or total (availability re-checked for CONFIRMED)
curl -s -X PATCH "$BASE/pms/reservations/$RESERVATION_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"guestId":"'$GUEST_ID'","roomId":"'$ROOM_ID'","totalAmount":8000}' | jq

# Delete reservation (not while CHECKED_IN — check out first)
curl -s -X DELETE "$BASE/pms/reservations/$RESERVATION_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

### Accounting integration (folio)

When **`paidAmount` increases** on `PATCH /reservations/:id/payment`, the API emits `reservation.payment_recorded` and posts:

- **Debit** Cash (`1000`) / **Credit** Room Revenue (`4000`) for the payment **delta**

On **check-out**, if `paidAmount < totalAmount`, emits `reservation.checked_out` and posts:

- **Debit** Accounts Receivable (`1300`) / **Credit** Room Revenue (`4000`) for the **unpaid balance**

Requires chart of accounts from seed or Settings. If accounts are missing, payment/check-out still succeed; journal entries are skipped. View resulting journals under **Accounting** → Journals.

`reservation.checked_in` is emitted on check-in for integrations (room status + Socket.IO); it does not post journals in phase 1.

### Room Status State Machine

```
                  ┌──────────────────┐
                  │                  │
                  ▼                  │
 ┌─────────┐  check-in   ┌──────────┴──┐  check-out   ┌─────────┐
 │  VACANT  │ ──────────► │  OCCUPIED   │ ───────────► │  DIRTY  │
 └─────────┘              └─────────────┘              └────┬────┘
      ▲                                                     │
      │                  housekeeping                       │
      └─────────────────────────────────────────────────────┘
```

**Reservation statuses:** `INQUIRY` → (confirm) → `CONFIRMED` → `CHECKED_IN` → `CHECKED_OUT`; cancel from `INQUIRY` or `CONFIRMED` only.

**IDs:** Seed and runtime records use prefixed IDs (`br_…`, `rm_…`, `res_…`, etc.) — see [pms-module.md](pms-module.md).

---

## 3. Point of Sale (POS)

The POS module handles menu management, order lifecycle, kitchen ticket flow, and payment.

> **Full reference:** [docs/pos-module.md](pos-module.md) — API tables, Web UI, state machines, folio integration, and testing.

### Web UI

| Route | Purpose |
|-------|---------|
| **`/pos` → Orders tab** | List orders (filter active/all/status); new order cart (table, notes, qty); submit to kitchen; complete & pay (full/partial); cancel; **delete** (DRAFT/CANCELLED only); link to Accounting journals |
| **`/pos` → Menu tab** | CRUD categories and menu items; **active/inactive** toggle on items |
| **`/pos/kitchen`** | Kitchen display (FIFO queue): SUBMITTED → PREPARING → READY; org/branch selector; Socket.IO live queue; link back to POS |

Select **organization** and **branch** in the header before using POS or the kitchen display.

### Step 1: List Menu Categories (with Items)

```bash
curl -s "$BASE/pos/menu/categories?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq
```

**Expected response (abridged):**
```json
[
  {
    "id": "cat-breakfast-uuid",
    "name": "Breakfast",
    "sortOrder": 1,
    "items": [
      { "id": "mi-paratha-uuid", "name": "Paratha & Egg", "price": "120" },
      { "id": "mi-toast-uuid", "name": "Toast & Butter", "price": "80" },
      { "id": "mi-omelette-uuid", "name": "Omelette", "price": "100" }
    ]
  },
  {
    "id": "cat-mains-uuid",
    "name": "Mains",
    "sortOrder": 2,
    "items": [
      { "id": "mi-biryani-uuid", "name": "Chicken Biryani", "price": "320" },
      { "id": "mi-fish-uuid", "name": "Grilled Fish", "price": "450" },
      { "id": "mi-sandwich-uuid", "name": "Club Sandwich", "price": "250" },
      { "id": "mi-beef-uuid", "name": "Beef Curry with Rice", "price": "350" }
    ]
  },
  {
    "id": "cat-beverages-uuid",
    "name": "Beverages",
    "sortOrder": 3,
    "items": [
      { "id": "mi-juice-uuid", "name": "Fresh Juice", "price": "120" },
      { "id": "mi-tea-uuid", "name": "Tea", "price": "50" },
      { "id": "mi-coffee-uuid", "name": "Coffee", "price": "100" }
    ]
  }
]
```

### Step 2: Create an Order

Use menu item IDs from Step 1. An order starts in `DRAFT` status.

```bash
curl -s -X POST "$BASE/pos/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "00000000-0000-0000-0000-000000000001",
    "tableNumber": "T7",
    "notes": "Guest allergic to nuts",
    "lines": [
      { "menuItemId": "<mi-biryani-uuid>", "quantity": 2, "unitPrice": 320 },
      { "menuItemId": "<mi-juice-uuid>", "quantity": 1, "unitPrice": 120 },
      { "menuItemId": "<mi-tea-uuid>", "quantity": 2, "unitPrice": 50 }
    ]
  }' | jq
```

**Expected response:**
```json
{
  "id": "new-order-uuid",
  "branchId": "00000000-0000-0000-0000-000000000001",
  "tableNumber": "T7",
  "notes": "Guest allergic to nuts",
  "status": "DRAFT",
  "totalAmount": "860",
  "paidAmount": "0",
  "lines": [
    { "menuItemId": "...", "quantity": 2, "unitPrice": "320", "lineTotal": "640", "menuItem": { "name": "Chicken Biryani" } },
    { "menuItemId": "...", "quantity": 1, "unitPrice": "120", "lineTotal": "120", "menuItem": { "name": "Fresh Juice" } },
    { "menuItemId": "...", "quantity": 2, "unitPrice": "50", "lineTotal": "100", "menuItem": { "name": "Tea" } }
  ]
}
```

### Step 3: Submit Order to Kitchen

```bash
ORDER_ID="<new-order-uuid>"

curl -s -X POST "$BASE/pos/orders/$ORDER_ID/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq
```

**What happens:**
1. Order status changes: `DRAFT` → `SUBMITTED`
2. A `KitchenTicket` record is created with status `SUBMITTED`
3. Socket.IO emits `kitchen.ticket` to the `kitchen:<branchId>` room (kitchen display screen)
4. Socket.IO emits `order.updated` to the same room

### Step 4: Kitchen status updates

Use the kitchen display (`/pos/kitchen`) or the API after submit. Kitchen steps are optional — you can complete payment directly from `SUBMITTED` (see [Step 6](#step-6-complete-the-order-with-payment)).

```bash
# Start prep
curl -s -X PATCH "$BASE/pos/orders/$ORDER_ID/status?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"PREPARING"}' | jq

# Mark ready for pickup
curl -s -X PATCH "$BASE/pos/orders/$ORDER_ID/status?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"READY"}' | jq
```

**Allowed transitions:** `SUBMITTED` → `PREPARING` → `READY`. Each update syncs the `KitchenTicket` and emits `order.updated` to `kitchen:<branchId>`.

### Step 5: Cancel an Order

```bash
curl -s -X POST "$BASE/pos/orders/$ORDER_ID/cancel?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

Only **DRAFT** or **SUBMITTED** orders can be cancelled. Cancelled orders disappear from the kitchen queue (Socket.IO `order.updated`).

### Step 6: Complete the Order (with Payment)

```bash
curl -s -X POST "$BASE/pos/orders/$ORDER_ID/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{ "paidAmount": 860 }' | jq
```

Allowed from **SUBMITTED**, **PREPARING**, or **READY** (kitchen prep steps are optional).

**What happens:**
1. Order status changes to `COMPLETED`
2. Payment status set: `PAID` (if `paidAmount >= totalAmount`), `PARTIAL`, or `UNPAID`
3. Event `order.completed` is emitted, which triggers:
   - **Inventory deduction** — recipe/BOM ingredients are deducted (see [Section 4](#4-inventory-management))
   - **Accounting entries** — revenue journal entry + COGS entry (see [Section 5](#5-accounting))
4. Socket.IO emits `order.updated` (order leaves the kitchen queue)

### Step 7: Delete draft or cancelled order

```bash
curl -s -X DELETE "$BASE/pos/orders/$ORDER_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

Only **DRAFT** or **CANCELLED** orders can be deleted. **COMPLETED** orders are kept for audit and accounting.

### Order Status Flow

```
  DRAFT  ──submit──►  SUBMITTED  ──kitchen──►  PREPARING  ──►  READY  ──complete──►  COMPLETED
    │                    │
    └──── cancel ────────┴──── cancel ───►  CANCELLED
```

### Kitchen Ticket Flow

When an order is submitted, a `KitchenTicket` is created and broadcast via Socket.IO. The kitchen display (`/pos/kitchen`) listens for `kitchen.ticket` and `order.updated` events and renders the FIFO queue in real-time.

```
Order Submitted
  → KitchenTicket created (status: SUBMITTED)
  → Socket.IO emits to kitchen:<branchId>
  → Kitchen screen displays new ticket (oldest first)
  → Staff: Start prep (PREPARING) → Mark ready (READY)
  → Cashier completes payment on POS (COMPLETED)
  → Order drops off kitchen queue

Cancel (SUBMITTED only)
  → KitchenTicket → CANCELLED
  → order.updated → ticket removed from kitchen screen
```

---

## 4. Inventory Management

The inventory system uses a **ledger model** — current stock is never stored directly; it is always computed as `SUM(IN) - SUM(OUT)`.

### Web UI

| Route | Purpose |
|-------|---------|
| **`/inventory` → Items tab** | List items with on-hand stock and LOW/OK status; **create** item; **edit** (click row: name, unit, low-stock threshold); **record movements** (purchase, waste, adjustment IN/OUT, etc.); movement history |
| **`/inventory` → Recipes (BOM) tab** | Select a menu item; edit bill-of-materials lines; save via recipe API |

> **Full reference:** [docs/inventory-module.md](inventory-module.md) — API tables, Web UI, movement types, recipe deduction, and testing.

### Step 1: List Items with Current Stock

```bash
curl -s "$BASE/inventory/items?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq
```

**Expected response (abridged):**
```json
[
  {
    "id": "inv-rice-uuid",
    "branchId": "00000000-0000-0000-0000-000000000001",
    "name": "Rice",
    "sku": "INV-001",
    "unit": "kg",
    "lowStockThreshold": 10,
    "currentStock": 49.1
  },
  {
    "id": "inv-chicken-uuid",
    "name": "Chicken",
    "sku": "INV-002",
    "unit": "kg",
    "lowStockThreshold": 5,
    "currentStock": 19.5
  },
  {
    "id": "inv-eggs-uuid",
    "name": "Eggs",
    "sku": "INV-004",
    "unit": "piece",
    "lowStockThreshold": 30,
    "currentStock": 115
  }
]
```

> Stock is computed live: `50kg purchased - 0.6kg sold - 0.3kg staff meal = 49.1kg` for Rice.

### Step 2: Create an Inventory Item

```bash
curl -s -X POST "$BASE/inventory/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "00000000-0000-0000-0000-000000000001",
    "name": "Basmati Rice",
    "sku": "RICE-01",
    "unit": "kg",
    "lowStockThreshold": 10
  }' | jq
```

### Step 3: Update an Item (name, unit, low-stock threshold)

```bash
curl -s -X PATCH "$BASE/inventory/items/$ITEM_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Premium Basmati","lowStockThreshold":15}' | jq
```

SKU cannot be changed after creation (unique per branch).

### Step 4: Create an Inventory Movement (Manual Purchase)

```bash
curl -s -X POST "$BASE/inventory/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "<inv-rice-uuid>",
    "branchId": "00000000-0000-0000-0000-000000000001",
    "movementType": "PURCHASE",
    "quantity": 25
  }' | jq
```

**Expected response:**
```json
{
  "id": "movement-uuid",
  "itemId": "inv-rice-uuid",
  "branchId": "00000000-0000-0000-0000-000000000001",
  "movementType": "PURCHASE",
  "direction": "IN",
  "quantity": "25",
  "createdAt": "2026-05-29T..."
}
```

### Step 5: Record a Waste Movement

```bash
curl -s -X POST "$BASE/inventory/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "<inv-eggs-uuid>",
    "branchId": "00000000-0000-0000-0000-000000000001",
    "movementType": "WASTE",
    "quantity": 3
  }' | jq
```

### Step 6: Record an Adjustment (IN or OUT)

```bash
curl -s -X POST "$BASE/inventory/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "<inv-rice-uuid>",
    "branchId": "00000000-0000-0000-0000-000000000001",
    "movementType": "ADJUSTMENT",
    "direction": "OUT",
    "quantity": 0.5
  }' | jq
```

### Ledger Model Explained

```
Current Stock = SUM(all IN movements) - SUM(all OUT movements)
```

There is no `currentStock` column in the database. Every stock query aggregates movements in real-time.

### Movement Types

| Type          | Direction | When Used                                  |
|---------------|-----------|--------------------------------------------|
| `PURCHASE`    | IN        | Goods bought from supplier                 |
| `ADJUSTMENT`  | IN or OUT | Correction — pass `"direction":"IN"` or `"OUT"` in API body |
| `SALE`        | OUT       | Deducted when a POS order is completed     |
| `WASTE`       | OUT       | Spoiled or damaged goods                   |
| `STAFF_MEAL`  | OUT       | Employee meals (linked to HR module)       |

### Recipe/BOM Auto-Deduction

Each menu item can have a **Recipe** (Bill of Materials) linking it to inventory items with quantities. Configure recipes in the web UI under **Inventory → Recipes (BOM)** (`/inventory`), or via API:

```
order.completed event
  → OrderEventsListener.handleOrderCompleted()
    → InventoryRecipesService.deductForOrder(orderId, branchId)
      → For each order line:
        → Load the menu item's recipe
        → For each recipe line:
          → Create an inventory movement (OUT, type: SALE)
          → quantity = recipeLine.quantity × orderLine.quantity
      → Returns estimated COGS
```

**Example:** Completing an order with 2× Chicken Biryani:
- Rice: 0.3 kg × 2 = 0.6 kg OUT
- Chicken: 0.25 kg × 2 = 0.5 kg OUT
- Cooking Oil: 0.05 L × 2 = 0.1 L OUT

### View an Item's Movement History

```bash
ITEM_ID="<inv-rice-uuid>"

curl -s "$BASE/inventory/items/$ITEM_ID/movements?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq
```

---

## 5. Accounting

The accounting module implements strict **double-entry bookkeeping**. Every journal entry must have `total debits == total credits`.

> **Full reference:** [docs/accounting-module.md](accounting-module.md) — API tables, Web UI, automated postings, permissions, and testing.

### Web UI

| Route | Purpose |
|-------|---------|
| **`/accounting` → Journal entries** | List recent journals with debit/credit lines |
| **`/accounting` → Chart of accounts** | List accounts; add new account (code, name, type) |
| **`/accounting` → New journal** | Manual multi-line entry with running balance check |

Accounting is **organization-scoped** (not branch). POS links here via “View journals →”.

### Step 1: List Chart of Accounts

```bash
curl -s "$BASE/accounting/accounts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

**Expected response (seed accounts):**
```json
[
  { "id": "acc-1000-uuid", "code": "1000", "name": "Cash", "type": "ASSET" },
  { "id": "acc-1100-uuid", "code": "1100", "name": "Bank Account", "type": "ASSET" },
  { "id": "acc-1200-uuid", "code": "1200", "name": "Inventory", "type": "ASSET" },
  { "id": "acc-1300-uuid", "code": "1300", "name": "Accounts Receivable", "type": "ASSET" },
  { "id": "acc-2000-uuid", "code": "2000", "name": "Accounts Payable", "type": "LIABILITY" },
  { "id": "acc-2100-uuid", "code": "2100", "name": "Salary Payable", "type": "LIABILITY" },
  { "id": "acc-3000-uuid", "code": "3000", "name": "Owner Equity", "type": "EQUITY" },
  { "id": "acc-4000-uuid", "code": "4000", "name": "Room Revenue", "type": "REVENUE" },
  { "id": "acc-4100-uuid", "code": "4100", "name": "F&B Revenue", "type": "REVENUE" },
  { "id": "acc-4200-uuid", "code": "4200", "name": "Other Revenue", "type": "REVENUE" },
  { "id": "acc-5000-uuid", "code": "5000", "name": "Cost of Goods Sold", "type": "EXPENSE" },
  { "id": "acc-5100-uuid", "code": "5100", "name": "Salary Expense", "type": "EXPENSE" },
  { "id": "acc-5200-uuid", "code": "5200", "name": "Utilities Expense", "type": "EXPENSE" },
  { "id": "acc-5300-uuid", "code": "5300", "name": "Maintenance Expense", "type": "EXPENSE" }
]
```

### Step 2: List Journal Entries

```bash
curl -s "$BASE/accounting/journals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

**Expected response (seed entries):**
```json
[
  {
    "id": "je-cogs-uuid",
    "description": "COGS - Order T3 ingredients",
    "referenceType": "Order",
    "lines": [
      { "accountId": "...", "debit": "180", "credit": "0", "account": { "name": "Cost of Goods Sold", "code": "5000" } },
      { "accountId": "...", "debit": "0", "credit": "180", "account": { "name": "Inventory", "code": "1200" } }
    ]
  },
  {
    "id": "je-fb-uuid",
    "description": "F&B Sale - Table T3",
    "referenceType": "Order",
    "lines": [
      { "debit": "690", "credit": "0", "account": { "name": "Cash", "code": "1000" } },
      { "debit": "0", "credit": "690", "account": { "name": "F&B Revenue", "code": "4100" } }
    ]
  },
  {
    "id": "je-room-uuid",
    "description": "Room 101 advance payment - Rahim Ahmed",
    "referenceType": "Reservation",
    "lines": [
      { "debit": "7000", "credit": "0", "account": { "name": "Cash", "code": "1000" } },
      { "debit": "0", "credit": "7000", "account": { "name": "Room Revenue", "code": "4000" } }
    ]
  }
]
```

### Step 3: Create a Manual Journal Entry

```bash
curl -s -X POST "$BASE/accounting/journals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Monthly electricity bill payment",
    "referenceType": "Expense",
    "lines": [
      { "accountId": "<acc-5200-uuid>", "debit": 12000, "credit": 0 },
      { "accountId": "<acc-1100-uuid>", "debit": 0, "credit": 12000 }
    ]
  }' | jq
```

This records: `Utilities Expense Dr 12,000 / Bank Account Cr 12,000`.

**Validation rules:**
- `total debits` must equal `total credits` — otherwise returns `400 Bad Request`
- At least 2 journal lines are required

### Auto-Posting on PMS Folio

See [PMS module — Accounting integration](pms-module.md#accounting-integration-folio). On payment delta: Cash / Room Revenue. On check-out with balance due: AR / Room Revenue.

### Double-Entry Rule

Every financial transaction is recorded with equal debits and credits:

```
  Debit   ==   Credit     (always)
```

### Auto-Posting on Order Completion

When `order.completed` fires, the `OrderEventsListener` triggers inventory deduction plus up to two journal entries:

**Entry 1: Revenue Recognition** (uses `paidAmount` and `totalAmount`)

| Payment | Lines |
|---------|-------|
| Full pay | Cash Dr `total` / F&B Revenue Cr `total` |
| Partial | Cash Dr `paid` + AR Dr `(total − paid)` / F&B Revenue Cr `total` |
| Unpaid | AR Dr `total` / F&B Revenue Cr `total` |

**Entry 2: COGS / Inventory Consumption** (when recipes exist)
```
  Cost of Goods Sold (5000)  Dr  <estimated COGS>
  Inventory (1200)               Cr  <estimated COGS>
```

### Worked Example with Numbers

A guest orders 2× Chicken Biryani (₹320 each) and 1× Tea (₹50). Total = ₹690.

**Revenue entry (auto):**
```
  Cash            Dr  690
  F&B Revenue         Cr  690
```

**Inventory deduction** (recipe-based):
- Rice: 0.6 kg, Chicken: 0.5 kg, Oil: 0.1 L, Tea Leaves: 0.005 kg, Sugar: 0.015 kg
- Estimated COGS = ₹180

**COGS entry (auto):**
```
  Cost of Goods Sold  Dr  180
  Inventory               Cr  180
```

---

## 6. HR & Payroll

The HR module manages employees, attendance tracking, staff meals, and payroll processing.

> **Full reference:** [docs/hr-module.md](hr-module.md) — API tables, Web UI tabs, staff meal deductions, payroll worker, and testing.

### Web UI (`/hr`)

Select **organization** and **branch** in the header (branch required for attendance and staff meals).

| Tab | Features |
|-----|----------|
| **Employees** | List staff; add employee (name, designation, salary) |
| **Attendance** | Clock in/out; recent attendance list for current branch |
| **Staff meals** | Define **meal recipes** (ingredients per meal); record consumption (employee + recipe + meal count); optional payroll deduction |
| **Payroll** | Run payroll for current month; view runs with gross / deductions / net |

### Step 1: List Employees

```bash
curl -s "$BASE/hr/employees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

**Expected response (abridged):**
```json
[
  {
    "id": "00000000-0000-0000-0000-000000000401",
    "name": "Karim Hossain",
    "designation": "Head Chef",
    "salary": "45000",
    "branchId": "00000000-0000-0000-0000-000000000001",
    "branch": { "name": "Main Hotel & Restaurant" }
  },
  {
    "id": "00000000-0000-0000-0000-000000000402",
    "name": "Nasreen Begum",
    "designation": "Front Desk Manager",
    "salary": "35000"
  },
  {
    "id": "00000000-0000-0000-0000-000000000403",
    "name": "Rashid Islam",
    "designation": "Waiter",
    "salary": "18000"
  },
  {
    "id": "00000000-0000-0000-0000-000000000404",
    "name": "Ayesha Rahman",
    "designation": "Housekeeper",
    "salary": "16000"
  },
  {
    "id": "00000000-0000-0000-0000-000000000405",
    "name": "Tanvir Alam",
    "designation": "Accountant",
    "salary": "40000"
  }
]
```

### Step 2: Clock Attendance

```bash
# Clock IN
curl -s -X POST "$BASE/hr/attendance/clock" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "00000000-0000-0000-0000-000000000403",
    "type": "CLOCK_IN"
  }' | jq
```

```bash
# Clock OUT (at end of shift)
curl -s -X POST "$BASE/hr/attendance/clock" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "00000000-0000-0000-0000-000000000403",
    "type": "CLOCK_OUT"
  }' | jq
```

**Attendance types:** `CLOCK_IN`, `CLOCK_OUT`

### Step 3: Define a Staff Meal Recipe

Staff meals are recipes (BOM). Each recipe defines ingredients per **one meal**.

```bash
curl -s -X POST "$BASE/hr/staff-meal-recipes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Staff Lunch",
    "lines": [
      { "inventoryItemId": "<inv-rice-uuid>", "quantity": 0.3 },
      { "inventoryItemId": "<inv-chicken-uuid>", "quantity": 0.15 }
    ]
  }' | jq
```

### Step 4: Record Staff Meal Consumption

Record how many meals an employee consumed. Inventory ingredients are auto-deducted from the recipe.

```bash
curl -s -X POST "$BASE/hr/staff-meals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "00000000-0000-0000-0000-000000000401",
    "staffMealRecipeId": "<staff-meal-recipe-uuid>",
    "mealCount": 1,
    "deductFromPayroll": false
  }' | jq
```

**What happens:**
1. For each recipe line: inventory movement (OUT, type: `STAFF_MEAL`) with `line.quantity × mealCount`
2. A `StaffMeal` consumption record is saved with `mealCount`
3. If `deductFromPayroll: true`, `mealCount × unitCostPerMeal` is deducted on the employee's next payroll run (meals marked `payrollDeducted` after processing)

### Step 5: Request a Payroll Run

```bash
curl -s -X POST "$BASE/hr/payroll/runs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "periodStart": "2026-05-01",
    "periodEnd": "2026-05-31"
  }' | jq
```

**Expected response:**
```json
{
  "id": "payroll-run-uuid",
  "organizationId": "00000000-0000-0000-0000-000000000100",
  "periodStart": "2026-05-01T00:00:00.000Z",
  "periodEnd": "2026-05-31T00:00:00.000Z",
  "status": "PENDING",
  "createdAt": "2026-05-29T..."
}
```

**What happens:**
1. A `PayrollRun` record is created with status `PENDING`
2. Event `payroll.run_requested` is emitted
3. `PayrollListener` picks it up and adds a job to the BullMQ `payroll` queue
4. The `PayrollProcessor` (BullMQ worker) processes salary calculations for each employee in the background
5. Payroll lines are created for each employee

### Step 6: View Payroll Runs

```bash
curl -s "$BASE/payroll/runs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

### BullMQ Background Processing

Payroll runs are processed asynchronously:

```
POST /hr/payroll/runs
  → Create PayrollRun (PENDING)
  → Emit "payroll.run_requested" event
  → PayrollListener adds job to BullMQ "payroll" queue
  → PayrollProcessor (worker) picks up job
    → Sum pending staff meals (deductFromPayroll, not yet payrollDeducted)
    → Create PayrollLine for each employee (gross, deductions, net)
    → Mark staff meals payrollDeducted
    → Update PayrollRun status → COMPLETED
```

---

## 7. Reporting & Dashboard

### Dashboard Endpoint

```bash
curl -s "$BASE/reporting/dashboard?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq
```

**Expected response:**
```json
{
  "occupancyPct": 14,
  "activeReservations": 1,
  "revenueToday": 690,
  "lowStockAlerts": 0,
  "lowStockItems": []
}
```

### Dashboard Metrics Explained

| Metric              | How It's Calculated                                                                 |
|---------------------|-------------------------------------------------------------------------------------|
| `occupancyPct`      | Rooms with status `OCCUPIED` ÷ total rooms in branch × 100                          |
| `activeReservations`| Count of reservations with status `INQUIRY`, `CONFIRMED`, or `CHECKED_IN`          |
| `revenueToday`      | Sum of `totalAmount` for COMPLETED POS orders created today                           |
| `lowStockAlerts`    | Count of items (all pools) where `currentStock <= lowStockThreshold`                  |
| `lowStockItems`     | Array of inventory items below their threshold                                      |

> **Full reference:** [docs/reporting-module.md](reporting-module.md) — dashboard, export types, job lifecycle, and testing.

### Web UI

| Page | Features |
|------|----------|
| `/dashboard` | Branch metrics + low-stock item list |
| `/reports` | Report type picker, async CSV export, job status table |

### Request a Report Export

```bash
curl -s -X POST "$BASE/reporting/export" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{ "type": "branch_summary", "branchId": "'$BRANCH_ID'" }' | jq
```

**Report types:** `branch_summary`, `low_stock`, `revenue_today` (alias: `summary` → `branch_summary`). List via `GET /reporting/types`.

**Expected response:**
```json
{
  "id": "report-job-uuid",
  "organizationId": "00000000-0000-0000-0000-000000000100",
  "type": "branch_summary",
  "status": "PENDING",
  "createdAt": "2026-05-29T..."
}
```

The report is generated asynchronously via BullMQ's `reports` queue.

### View Report Job Status

```bash
curl -s "$BASE/reporting/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

---

## 8. Event-Driven Architecture

The application uses `@nestjs/event-emitter` (EventEmitter2) for internal event-driven communication between modules. Events are emitted synchronously within the same process.

### Event Catalog

| Event                      | Emitted By           | Payload                                                |
|----------------------------|----------------------|--------------------------------------------------------|
| `order.completed`          | `PosService`         | `{ orderId, branchId, organizationId, totalAmount }`   |
| `reservation.checked_in`   | `PmsService`         | `{ reservationId, roomId, branchId }`                  |
| `reservation.payment_recorded` | `PmsService`     | `{ organizationId, reservationId, deltaPaid }`           |
| `reservation.checked_out`  | `PmsService`         | `{ organizationId, reservationId, unpaidAmount }`      |
| `payroll.run_requested`    | `HrService`          | `{ payrollRunId }`                                     |

### Event Flow Diagrams

#### Order Completed → Full Pipeline

```
┌──────────────────┐
│ order.completed   │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  OrderEventsListener.handleOrderCompleted() │
│                                             │
│  1. Inventory Deduction                     │
│     └─ deductForOrder() → creates OUT       │
│        movements per recipe/BOM             │
│        └─ Returns estimated COGS            │
│                                             │
│  2. Revenue Journal Entry                   │
│     └─ Cash Dr / F&B Revenue Cr             │
│                                             │
│  3. COGS Journal Entry (if COGS > 0)        │
│     └─ COGS Dr / Inventory Cr              │
└─────────────────────────────────────────────┘
```

#### Reservation Check-In

```
┌─────────────────────────┐
│ reservation.checked_in   │
└────────┬────────────────┘
         │
         ├──► Room status → OCCUPIED
         └──► Socket.IO → room.status event
```

#### Payroll Run

```
┌──────────────────────────┐
│ payroll.run_requested     │
└────────┬─────────────────┘
         │
         ▼
┌────────────────────────┐
│ PayrollListener         │
│ → Adds to BullMQ queue │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ PayrollProcessor        │
│ (background worker)     │
│ → Calculate salaries    │
│ → Create payroll lines  │
│ → Update run status     │
└─────────────────────────┘
```

#### End-to-End: Guest Orders Food

```
Waiter creates order (DRAFT)
  │
  ▼
Waiter submits to kitchen (SUBMITTED)
  │
  ├──► KitchenTicket created
  └──► Socket.IO → kitchen.ticket (kitchen screen updates)
  │
  ▼
Kitchen: Start prep (PREPARING) → Mark ready (READY)
  │
  └──► Socket.IO → order.updated (kitchen screen updates)
  │
  ▼
Waiter completes order on POS (COMPLETED, paidAmount)
  │
  ├──► Event: order.completed
  │     │
  │     ├──► Inventory: Recipe ingredients deducted
  │     │     Rice -0.6kg, Chicken -0.5kg, Oil -0.1L ...
  │     │
  │     ├──► Accounting: Cash Dr 690 / F&B Revenue Cr 690
  │     │
  │     └──► Accounting: COGS Dr 180 / Inventory Cr 180
  │
  └──► Socket.IO → order.updated
```

---

## 9. Realtime (Socket.IO)

The application uses Socket.IO for real-time updates. The gateway runs on the same port as the NestJS API (`:3001`).

### Socket.IO Events

| Event            | Room Pattern        | Payload                          | Trigger                |
|------------------|---------------------|----------------------------------|------------------------|
| `kitchen.ticket` | `kitchen:<branchId>`| Kitchen ticket object            | Order submitted        |
| `order.updated`  | `kitchen:<branchId>`| Full order object                | Order status change    |
| `room.status`    | `branch:<branchId>` | `{ roomId, status }`             | Check-in / check-out   |

### Connecting from the Frontend

```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:3001", {
  transports: ["websocket"],
});

// Join a room to receive branch-specific events
socket.emit("join", `kitchen:00000000-0000-0000-0000-000000000001`);
socket.emit("join", `branch:00000000-0000-0000-0000-000000000001`);

// Listen for kitchen tickets (new orders for the kitchen screen)
socket.on("kitchen.ticket", (ticket) => {
  console.log("New kitchen ticket:", ticket);
});

// Listen for order updates
socket.on("order.updated", (order) => {
  console.log("Order updated:", order);
});

// Listen for room status changes (housekeeping / front desk)
socket.on("room.status", ({ roomId, status }) => {
  console.log(`Room ${roomId} is now ${status}`);
});
```

### Room Naming Convention

- `kitchen:<branchId>` — Kitchen display screens and POS terminals subscribe here
- `branch:<branchId>` — Front desk and housekeeping screens subscribe here

---

## 10. Testing

### Unit Tests

```bash
# Run all unit tests from the repo root
pnpm test
```

### End-to-End Tests

```bash
# Run E2E tests for the web app
cd apps/web && pnpm test:e2e

# Module-specific suites
pnpm --filter @erp/web test:e2e pos      # orders, menu, lifecycle
pnpm --filter @erp/web test:e2e kitchen  # kitchen display, prep → ready, cancel queue
pnpm --filter @erp/web test:e2e inventory
pnpm --filter @erp/web test:e2e accounting
pnpm --filter @erp/web test:e2e hr
pnpm --filter @erp/web test:e2e reports
pnpm --filter @erp/web test:e2e settings
pnpm --filter @erp/web test:e2e dashboard
```

### Test Coverage

```bash
pnpm test -- --coverage
```

### Test Strategy

| Layer         | Tool            | What's Tested                            |
|---------------|-----------------|------------------------------------------|
| Unit          | Jest            | Services, guards, pipes, event listeners |
| Integration   | Jest + Prisma   | Database operations, transactions        |
| E2E           | Playwright      | Full user workflows via the browser      |

Key E2E specs: `e2e/pms.spec.ts`, `e2e/pos.spec.ts`, `e2e/kitchen.spec.ts`, `e2e/inventory.spec.ts`, `e2e/accounting.spec.ts`, `e2e/hr.spec.ts`, `e2e/reports.spec.ts`, `e2e/settings.spec.ts`, `e2e/dashboard.spec.ts`.

---

## Appendix: API Quick Reference

### PMS Endpoints

See [pms-module.md](pms-module.md) for curl examples.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET/POST | `/pms/branches` | PMS_READ/WRITE | List/create branches |
| GET/POST | `/pms/room-types` | PMS_READ/WRITE | List/create room types |
| PATCH | `/pms/room-types/:id` | PMS_WRITE | Update room type |
| DELETE | `/pms/room-types/:id` | PMS_WRITE | Delete room type |
| GET | `/pms/rooms?branchId=` | PMS_READ | List rooms |
| GET | `/pms/rooms/:id` | PMS_READ | Get room |
| POST | `/pms/rooms` | PMS_WRITE | Create room |
| PATCH | `/pms/rooms/:id` | PMS_WRITE | Update room |
| PATCH | `/pms/rooms/:id/status` | PMS_WRITE | Housekeeping status |
| DELETE | `/pms/rooms/:id` | PMS_WRITE | Delete room |
| GET/POST | `/pms/guests` | PMS_READ/WRITE | List/create guests |
| GET/PATCH/DELETE | `/pms/guests/:id` | PMS_READ/WRITE | Guest CRUD |
| GET/POST | `/pms/reservations?branchId=` | PMS_READ/WRITE | List/create reservations |
| GET/PATCH | `/pms/reservations/:id` | PMS_READ/WRITE | Get/update reservation |
| PATCH | `/pms/reservations/:id/confirm` | PMS_WRITE | INQUIRY → CONFIRMED |
| PATCH | `/pms/reservations/:id/payment` | PMS_WRITE | Set paidAmount |
| GET | `/pms/availability` | PMS_READ | Available rooms for dates |
| PATCH | `/pms/reservations/:id/check-in` | PMS_WRITE | Check-in |
| PATCH | `/pms/reservations/:id/check-out` | PMS_WRITE | Check-out |
| PATCH | `/pms/reservations/:id/cancel` | PMS_WRITE | Cancel |
| DELETE | `/pms/reservations/:id` | PMS_WRITE | Delete reservation |

### POS Endpoints

See [pos-module.md](pos-module.md) for curl examples.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/pos/menu/categories?branchId=` | POS_READ | List categories + items |
| POST | `/pos/menu/categories` | POS_WRITE | Create category |
| PATCH | `/pos/menu/categories/:id` | POS_WRITE | Update category |
| DELETE | `/pos/menu/categories/:id` | POS_WRITE | Delete category |
| POST | `/pos/menu/items` | POS_WRITE | Create menu item |
| PATCH | `/pos/menu/items/:id` | POS_WRITE | Update menu item |
| DELETE | `/pos/menu/items/:id` | POS_WRITE | Delete menu item |
| GET | `/pos/orders?branchId=` | POS_READ | List orders |
| GET | `/pos/orders/:id` | POS_READ | Get order |
| POST | `/pos/orders` | POS_WRITE | Create order |
| POST | `/pos/orders/:id/submit` | POS_WRITE | Submit to kitchen |
| POST | `/pos/orders/:id/complete` | POS_WRITE | Complete + pay |
| POST | `/pos/orders/:id/cancel` | POS_WRITE | Cancel order |
| DELETE | `/pos/orders/:id` | POS_WRITE | Delete order (DRAFT/CANCELLED) |
| PATCH | `/pos/orders/:id/status` | POS_WRITE | Kitchen status |

### Inventory Endpoints

See [inventory-module.md](inventory-module.md) for curl examples.

| Method | Path                                | Permission      | Description            |
|--------|--------------------------------------|----------------|------------------------|
| GET    | `/inventory/items?branchId=`         | INVENTORY_READ | List items + stock     |
| POST   | `/inventory/items`                   | INVENTORY_WRITE| Create item            |
| PATCH  | `/inventory/items/:id`               | INVENTORY_WRITE| Update item            |
| GET    | `/inventory/items/:id/stock`         | INVENTORY_READ | Get current stock      |
| POST   | `/inventory/movements`               | INVENTORY_WRITE| Create movement        |
| GET    | `/inventory/items/:id/movements`     | INVENTORY_READ | Movement history       |
| POST   | `/inventory/recipes`                 | INVENTORY_WRITE| Upsert recipe/BOM      |
| GET    | `/inventory/recipes/:menuItemId`     | INVENTORY_READ | Get recipe             |

### Accounting Endpoints

See [accounting-module.md](accounting-module.md) for curl examples.

| Method | Path                                | Permission        | Description            |
|--------|--------------------------------------|-------------------|------------------------|
| GET    | `/accounting/accounts`               | ACCOUNTING_READ  | List chart of accounts |
| POST   | `/accounting/accounts`               | ACCOUNTING_WRITE | Create account         |
| GET    | `/accounting/journals`               | ACCOUNTING_READ  | List journal entries   |
| POST   | `/accounting/journals`               | ACCOUNTING_WRITE | Create journal entry   |

### HR & Payroll Endpoints

| Method | Path                                | Permission  | Description            |
|--------|--------------------------------------|------------|------------------------|
| GET    | `/hr/employees`                      | HR_READ    | List employees         |
| POST   | `/hr/employees`                      | HR_WRITE   | Create employee        |
| GET    | `/hr/attendance`                     | HR_READ    | List attendance (branch) |
| POST   | `/hr/attendance/clock`               | HR_WRITE   | Clock in/out           |
| GET    | `/hr/staff-meal-recipes`             | HR_READ    | List staff meal recipes |
| POST   | `/hr/staff-meal-recipes`             | HR_WRITE   | Create staff meal recipe |
| PUT    | `/hr/staff-meal-recipes/:id`         | HR_WRITE   | Update staff meal recipe |
| GET    | `/hr/staff-meals`                    | HR_READ    | List meal consumption  |
| POST   | `/hr/staff-meals`                    | HR_WRITE   | Record meals consumed  |
| POST   | `/hr/payroll/runs`                   | HR_WRITE   | Request payroll run    |
| GET    | `/payroll/runs`                      | HR_READ    | List payroll runs      |
| GET    | `/payroll/runs/:id`                  | HR_READ    | Get payroll run        |

### Reporting Endpoints

| Method | Path                                | Permission    | Description            |
|--------|--------------------------------------|--------------|------------------------|
| GET    | `/reporting/dashboard?branchId=`     | REPORTS_READ | Dashboard metrics      |
| GET    | `/reporting/types`                   | REPORTS_READ | Export type catalog    |
| POST   | `/reporting/export`                  | REPORTS_READ | Request report export  |
| GET    | `/reporting/jobs`                    | REPORTS_READ | List report jobs       |

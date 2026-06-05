# Hospitality ERP — Application Workflow Guide

> A step-by-step walkthrough of every module in the Hospitality ERP, complete with curl examples using seed data.

---

## Table of Contents

- [Visual guide](./visual-guide.md) — module screenshots and Mermaid journeys (generate with `pnpm --filter @erp/web test:visual-guide`)
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
- [11. Procurement](#11-procurement)
- [12. Notifications](#12-notifications)
- [13. Integrations (Channel Manager)](#13-integrations-channel-manager)
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
| Guest packages  |     2 | Full board (3 meals), Budget (1 meal)     |
| Inclusion recipes |   4 | Breakfast meal, Lunch meal, Dinner meal, Standard amenity kit |
| Vendors         |     1 | Fresh Foods Ltd (procurement)             |
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
BASE="http://localhost:3001/api"
```

All API paths in this guide are relative to `$BASE` (NestJS global prefix `api`).

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
         ├── Procurement ─ vendors, POs (branch)
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
| **Delete branch** | Removes a branch after confirmation; cannot delete the only branch or one with active reservations. |
| **Team & access** | Invite by email, revoke invites, approve/reject join requests, change roles, remove members, copy join code. |
| **Audit log** | Filterable list of create/update/delete actions (who, what, when). |
| **Inventory pools** | View/edit guest, staff, and housekeeping pools; add custom pools (codes as text slugs). |
| **Branch access** | Restrict which branches a member can select in the header (empty = all branches). |
| **Integrations** | OTA/channel connections — see [§13 Integrations](#13-integrations-channel-manager) |
| **Notifications** | Per-type in-app and email preferences (all users). |

After changes, the app refreshes memberships so the header **Organization / Branch** dropdowns stay in sync.

> **References:** [settings-module.md](settings-module.md), [organization-onboarding.md](organization-onboarding.md), [phase2/channel-manager.md](phase2/channel-manager.md).

### Team & access API (invite / join)

```bash
# List pending email invites (admin)
curl -s "$BASE/tenants/invites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

# Send invite
curl -s -X POST "$BASE/tenants/invites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@example.com","role":"FRONT_DESK"}' | jq

# List pending join requests (admin)
curl -s "$BASE/tenants/join-requests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

# Approve join request with role
curl -s -X POST "$BASE/tenants/join-requests/$REQUEST_ID/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"role":"CASHIER"}' | jq

# Audit log (admin)
curl -s "$BASE/audit/logs?limit=50" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

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

**Delete branch:**

```bash
curl -s -X DELETE "$BASE/tenants/branches/$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

Returns `400` if this is the last branch, `409` if active reservations exist. On success, branch-scoped data (rooms, reservations, POS, inventory, etc.) is permanently removed.

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

The PMS module handles room types, rooms, guests, **guest packages**, **rate plans**, reservations, availability, housekeeping, stay **inclusions**, and realtime room status per branch.

> **Full references:** [pms-module.md](pms-module.md), [guest-inclusions-module.md](guest-inclusions-module.md), [visual-guide.md § PMS setup](./visual-guide.md#pms--recommended-setup-order).

### Web UI (`/pms`)

After selecting **organization** and **branch** in the header, open **PMS** in the sidebar:

| Tab | Features |
|-----|----------|
| **Reservations** | Create CONFIRMED/INQUIRY; **adults/children**, **guest package**, optional **meals/night override**; **pricing quote** in drawer; confirm; check-in/out; cancel; **Payment**; **Inclusions** panel when CHECKED_IN; edit; delete (not while CHECKED_IN) |
| **Rooms** | CRUD rooms; housekeeping **VACANT** / **DIRTY** / **MAINTENANCE**; Socket.IO `room.status` |
| **Room types** | CRUD types (`maxAdults`, `maxChildren`) |
| **Guests** | CRUD org-wide guest book |
| **Guest packages** | **Inclusion recipes** (meal/amenity BOM) and **packages** (meals per night, kits per stay) |
| **Rates** | **Rate plans** per room type + date range; optional **guest package** + F&B supplement; **rules** (day of week, min stay, price override) |

Branch creation is under **Settings** (`/tenants/branches`). Use `POST /pms/branches` only for API/scripts.

### Recommended setup order

Create master data **before** reservations. Rate plans need a **room type**; packages need **inclusion recipes** (inventory items in guest/housekeeping pools).

| Order | Tab | Action |
|------:|-----|--------|
| 1 | Room types | + Add room type |
| 2 | Rooms | + Add room (type, base price) |
| 3 | Guests | + Add guest |
| 4a | Guest packages | + New recipe (meal or amenity BOM) |
| 4b | Guest packages | + New package (link recipes, meals/night) |
| 5 | Rates | + Add rate plan (+ rules on plan row) |
| 6 | Reservations | + New reservation (quote → total) |
| 7+ | Reservations / Rooms | Confirm → check-in → inclusions → payment → check-out → housekeeping |

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

### Step 4a: Guest inclusion recipes

Recipes are branch-scoped BOMs for one **meal** (guest pool) or **amenity kit** (housekeeping pool).

```bash
# List recipes for branch
curl -s "$BASE/inclusions/recipes?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq

# Create meal recipe (use inventory item IDs from /inventory/items)
curl -s -X POST "$BASE/inclusions/recipes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "'$BRANCH_ID'",
    "name": "Breakfast meal",
    "inclusionType": "MEAL",
    "lines": [
      { "inventoryItemId": "<eggs-inv-id>", "quantity": 2 },
      { "inventoryItemId": "<bread-inv-id>", "quantity": 2 }
    ]
  }' | jq
```

Seed includes **Breakfast meal**, **Lunch meal**, **Dinner meal**, and **Standard amenity kit** on the main branch.

### Step 4b: Guest packages

Packages are organization-scoped bundles (meals per guest per night, amenity kits per stay).

```bash
curl -s "$BASE/inclusions/packages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/inclusions/packages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Full board (3 meals)",
    "isDefault": true,
    "rules": [
      {
        "inclusionType": "MEAL",
        "inclusionRecipeId": "<breakfast-recipe-id>",
        "quantityPerGuestPerNight": 1
      },
      {
        "inclusionType": "MEAL",
        "inclusionRecipeId": "<lunch-recipe-id>",
        "quantityPerGuestPerNight": 1
      },
      {
        "inclusionType": "MEAL",
        "inclusionRecipeId": "<dinner-recipe-id>",
        "quantityPerGuestPerNight": 1
      },
      {
        "inclusionType": "AMENITY_KIT",
        "inclusionRecipeId": "<amenity-recipe-id>",
        "quantityPerGuestPerStay": 1,
        "autoIssueOnCheckIn": true
      }
    ]
  }' | jq
```

Save `PACKAGE_ID` from the list response (seed default: **Full board (3 meals)**).

### Step 4c: Rate plans and rules

Rate plans apply to a **room type** and date range. Optionally attach a **guest package** and **F&B supplement per guest per night** (added to the stay quote).

```bash
ROOM_TYPE_ID="00000000-0000-0000-0000-000000000010"

curl -s "$BASE/pms/rate-plans" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/pms/rate-plans" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "roomTypeId": "'$ROOM_TYPE_ID'",
    "name": "Summer standard",
    "validFrom": "2026-01-01T00:00:00Z",
    "validTo": "2026-12-31T23:59:59Z",
    "baseModifier": 1,
    "isActive": true,
    "inclusionPackageId": "'$PACKAGE_ID'",
    "fbSupplementPerGuestPerNight": 800
  }' | jq

# Add rule: Saturday nights at fixed price
curl -s -X POST "$BASE/pms/rate-plans/$RATE_PLAN_ID/rules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"dayOfWeek": 6, "pricePerNight": 5000}' | jq
```

Pricing uses each room's `basePrice` × plan `baseModifier`, then rule overrides (day of week, min stay). F&B supplement = `fbSupplementPerGuestPerNight × nights × (adults + children)` when a package is linked.

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

### Step 5b: Pricing quote (before booking)

```bash
curl -s "$BASE/pms/pricing/quote?roomId=$ROOM_ID&checkIn=2026-06-01T14:00:00Z&checkOut=2026-06-03T11:00:00Z&adultCount=2&childCount=0" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

Response includes `roomTotal`, optional `fbSupplement`, and `total` — use `total` as `totalAmount` on create/update when rate plans apply.

### Step 6: Create a Reservation

Use the guest ID from Step 4 and a room ID from Step 5. Omit `totalAmount` to auto-calculate from rate plans when configured.

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
    \"adultCount\": 2,
    \"childCount\": 0,
    \"packageId\": \"$PACKAGE_ID\",
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
# Edit guest, dates, room, party, package, or total (availability re-checked for CONFIRMED)
curl -s -X PATCH "$BASE/pms/reservations/$RESERVATION_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"guestId":"'$GUEST_ID'","roomId":"'$ROOM_ID'","adultCount":2,"totalAmount":8000}' | jq

# Delete reservation (not while CHECKED_IN — check out first)
curl -s -X DELETE "$BASE/pms/reservations/$RESERVATION_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

### Step 12: Guest inclusions (checked-in stays)

On **check-in**, allowances are snapshotted (meals and kits entitled vs consumed). Amenity kits with `autoIssueOnCheckIn` deduct housekeeping stock.

```bash
# Entitled vs consumed (also shown in Reservations → Inclusions drawer)
curl -s "$BASE/inclusions/reservations/$RESERVATION_ID/allowances?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

# Manual meal or kit issue
curl -s -X POST "$BASE/inclusions/reservations/$RESERVATION_ID/consume?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"inclusionType":"MEAL","inclusionRecipeId":"<meal-recipe-id>","quantity":1}' | jq

# Refresh snapshot after package/rule changes (checked-in only)
curl -s -X POST "$BASE/inclusions/reservations/$RESERVATION_ID/reconcile?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

**POS:** Menu items flagged **Guest inclusion meal** consume meal allowance on `order.completed` when the order has `reservationId` (charge to room). See [Section 3](#3-point-of-sale-pos).

### Accounting integration (folio)

When **`paidAmount` increases** on `PATCH /reservations/:id/payment`, the API emits `reservation.payment_recorded` and posts:

- **Debit** Cash (`1000`) / **Credit** Room Revenue (`4000`) for the payment **delta**

On **check-out**, if `paidAmount < totalAmount`, emits `reservation.checked_out` and posts:

- **Debit** Accounts Receivable (`1300`) / **Credit** Room Revenue (`4000`) for the **unpaid balance**

Requires chart of accounts from seed or Settings. If accounts are missing, payment/check-out still succeed; journal entries are skipped. View resulting journals under **Accounting** → Journals.

`reservation.checked_in` also triggers the **inclusions** listener (allowance snapshot, auto-issue amenity kits). It does not post GL journals.

### Room Status State Machine

```
VACANT ◄── housekeeping ── DIRTY ◄── check-out ── OCCUPIED ◄── check-in
  ▲                                                      │
  └──────── MAINTENANCE ◄────────────────────────────────┘
```

- **MAINTENANCE** rooms are excluded from availability.
- Housekeeping API: `DIRTY→VACANT`, `VACANT↔MAINTENANCE` (not `OCCUPIED` — only check-in sets that).

**Reservation statuses:** `INQUIRY` → (confirm) → `CONFIRMED` → `CHECKED_IN` → `CHECKED_OUT`; cancel from `INQUIRY` or `CONFIRMED` only.

**IDs:** Seed and runtime records use prefixed IDs (`br_…`, `rm_…`, `res_…`, etc.) — see [pms-module.md](pms-module.md).

---

## 3. Point of Sale (POS)

The POS module handles menu management, order lifecycle, kitchen ticket flow, and payment.

> **Full reference:** [docs/pos-module.md](pos-module.md) — API tables, Web UI, state machines, folio integration, and testing.

### Web UI

| Route | Purpose |
|-------|---------|
| **`/pos` → Orders tab** | New order cart; optional **Charge to room** (`reservationId` for CHECKED_IN stays); submit to kitchen; complete & pay (full/partial/unpaid); cancel; delete (DRAFT/CANCELLED); link to Accounting journals |
| **`/pos` → Menu tab** | CRUD categories and items; **Guest inclusion meal** flag (board meals tied to stay allowances) |
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
      { "id": "mi-biryani-uuid", "name": "Chicken Biryani", "price": "320", "isGuestInclusionMeal": true },
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

Seed data marks **Chicken Biryani** as a guest inclusion meal (`isGuestInclusionMeal: true`).

### Step 1b: Guest inclusion meal flag (Menu)

Use this for **complimentary board meals** (full/half board packages from [§2](#step-4b-guest-packages)). The flag does not change menu price at the till — it tells the system which POS line items count against the guest’s **MEAL** allowance when the order is tied to a checked-in stay.

| Requirement | Why |
|-------------|-----|
| Menu item `isGuestInclusionMeal: true` | Line counts toward meal consumption |
| Order `reservationId` set | Links sale to an in-house stay |
| Reservation `CHECKED_IN` | Allowances exist (snapshotted at check-in) |
| Guest package with MEAL rules | Entitled qty per night × party size |

**Web UI:** **POS → Menu** → edit item → **Guest inclusion meal** = Yes. Flagged items show a badge in the menu list.

**Create a new inclusion meal item:**

```bash
CAT_ID="<mains-category-uuid-from-step-1>"

curl -s -X POST "$BASE/pos/menu/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryId": "'$CAT_ID'",
    "name": "Board breakfast",
    "price": 0,
    "isActive": true,
    "isGuestInclusionMeal": true
  }' | jq
```

**Enable the flag on an existing item** (seed Biryani example):

```bash
MENU_ITEM_ID="<mi-biryani-uuid>"

curl -s -X PATCH "$BASE/pos/menu/items/$MENU_ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"isGuestInclusionMeal": true}' | jq
```

**Turn off** the flag with `"isGuestInclusionMeal": false`. Items already on old orders keep their stored line prices; the flag only affects future orders.

**On `order.completed`** (after [Step 6](#step-6-complete-the-order-with-payment)), when `reservationId` is set and the stay is `CHECKED_IN`:

1. Sum `quantity` on order lines whose menu item has `isGuestInclusionMeal: true`.
2. Increment **consumed** on the stay’s MEAL allowance (same recipe as the package snapshot).
3. Post **GUEST_INCLUSION** inventory movements from the inclusion recipe BOM (guest pool).

If consumed would exceed **entitled**, complete fails with `400` (e.g. guest already used nightly meals). Use **PMS → Reservations → Inclusions** to review balances ([§2 Step 12](#step-12-guest-inclusions-checked-in-stays)).

Non-inclusion lines on the same order still run normal F&B revenue, payment, and recipe COGS. Beverages and à la carte items should stay **`isGuestInclusionMeal: false`**.

> See [guest-inclusions-module.md](guest-inclusions-module.md) for allowance formulas and manual consume/reconcile.

### Step 2: Create an Order

Use menu item IDs from Step 1. An order starts in `DRAFT` status. For in-house guests, pass `reservationId` of a **CHECKED_IN** stay to **charge to room** (links order to PMS). Include at least one line with an inclusion meal item ([Step 1b](#step-1b-guest-inclusion-meal-flag-menu)) if you want POS to deduct board meals on complete.

```bash
curl -s -X POST "$BASE/pos/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "00000000-0000-0000-0000-000000000001",
    "tableNumber": "T7",
    "reservationId": "<checked-in-reservation-id>",
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
   - **Guest inclusion meals** — if `reservationId` + inclusion-flagged lines ([Step 1b](#step-1b-guest-inclusion-meal-flag-menu)), MEAL allowance + `GUEST_INCLUSION` stock
   - **Inventory deduction** — menu recipe/BOM (SALE) for all lines with recipes
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
| **`/inventory` → Items tab** | Filter by **pool** (guest, staff, housekeeping, custom); on-hand stock; create/edit item; record movements; history |
| **`/inventory` → Recipes (BOM) tab** | Guest-pool menu item BOM; POS completion deducts stock (weighted-average COGS) |

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
| `PURCHASE`    | IN        | Manual purchase or **procurement receive** |
| `ADJUSTMENT`  | IN or OUT | Correction — pass `"direction":"IN"` or `"OUT"` in API body |
| `SALE`        | OUT       | Deducted when a POS order is completed     |
| `WASTE`       | OUT       | Spoiled or damaged goods                   |
| `STAFF_MEAL`  | OUT       | Employee meals (linked to HR module)       |
| `GUEST_INCLUSION` | OUT   | Guest package meal/kit (check-in or manual)  |

**Costing:** IN movements update per-item `averageUnitCost` (weighted average). COGS uses `qty × averageUnitCost`.

**Pools:** `guest`, `staff`, `housekeeping` (system) + custom pools in **Settings**. API: `GET/POST/PATCH /inventory/pools`.

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
| **`/accounting` → Journal entries** | List journals; **Reverse** balanced entries |
| **`/accounting` → Chart of accounts** | List accounts; add account (code, name, type) |
| **`/accounting` → Post journal** | Manual multi-line entry (must balance; requires open fiscal period) |
| **`/accounting` → Fiscal periods** | Create periods; close/reopen (blocks posting outside open periods) |

Accounting is **organization-scoped** (not branch). Auto-posting also runs for PMS folio, POS, **procurement receive**, **vendor payments**, and **payroll runs**.

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
- `entryDate` must fall in an **open** fiscal period (create periods under **Fiscal periods** tab)

### Fiscal periods

```bash
curl -s "$BASE/accounting/fiscal-periods" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/accounting/fiscal-periods" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"May 2026","startDate":"2026-05-01","endDate":"2026-05-31"}' | jq

curl -s -X PATCH "$BASE/accounting/fiscal-periods/$PERIOD_ID/close" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

### Journal reversal

```bash
curl -s -X POST "$BASE/accounting/journals/$JOURNAL_ID/reverse" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"entryDate":"2026-05-15"}' | jq
```

Creates an offsetting entry linked to the original (`reversesEntryId`).

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

### Auto-Posting on Procurement

| Event | Journal |
|-------|---------|
| Goods receipt | Inventory (1200) Dr / Accounts Payable (2000) Cr |
| Vendor payment | AP (2000) Dr / Cash (1000) or Bank (1100) Cr |

See [Section 11](#11-procurement).

### Auto-Posting on Payroll

When a payroll run **completes**, `PayrollJournalService` posts salary expense / salary payable for net pay. See [Section 6](#step-6-view-payroll-runs).

---

## 6. HR & Payroll

The HR module manages employees, attendance tracking, staff meals, and payroll processing.

> **Full reference:** [docs/hr-module.md](hr-module.md) — API tables, Web UI tabs, staff meal deductions, payroll worker, and testing.

### Web UI (`/hr`)

Select **organization** and **branch** in the header (branch required for attendance and staff meals).

| Tab | Features |
|-----|----------|
| **Employees** | List staff; add, edit, terminate, and reactivate employees |
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

### Step 1b: Update or terminate an employee

```bash
curl -s -X PATCH "$BASE/hr/employees/$EMP_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Karim Hossain","designation":"Head Chef","salary":48000}' | jq

curl -s -X PATCH "$BASE/hr/employees/$EMP_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"TERMINATED"}' | jq
```

Terminated employees are kept for payroll history but excluded from new payroll runs, attendance, and staff meals. Reactivate with `{"status":"ACTIVE"}`.

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

curl -s "$BASE/payroll/runs/$PAYROLL_RUN_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

### Step 7: Download payslip PDF

When the run status is `COMPLETED`, download the per-employee payslip (stored in object storage):

```bash
curl -s "$BASE/payroll/runs/$PAYROLL_RUN_ID/payslip?employeeId=$EMPLOYEE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -o payslip.pdf
```

In the UI: **HR → Payroll** → download icon on a completed run row.

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
    → Upload payslip PDF to storage
    → Post payroll GL journal (Salary Expense / Salary Payable)
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

**Branch report types:** `branch_summary`, `low_stock`, `revenue_today` (alias: `summary` → `branch_summary`).

**Financial report types** (organization-wide; CSV or PDF):

| Type | Params | Formats |
|------|--------|---------|
| `trial_balance` | `asOf` | csv, pdf |
| `profit_and_loss` | `from`, `to` | csv, pdf |
| `balance_sheet` | `asOf` | csv, pdf |
| `general_ledger` | `from`, `to`, `accountCode` | csv, pdf |

List all types: `GET /reporting/types`.

```bash
curl -s -X POST "$BASE/reporting/export" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "trial_balance",
    "asOf": "2026-05-31",
    "format": "pdf"
  }' | jq

curl -s -X POST "$BASE/reporting/export" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "profit_and_loss",
    "from": "2026-05-01",
    "to": "2026-05-31",
    "format": "csv"
  }' | jq
```

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

**Listeners (not separate events):**

| Trigger | Listener | Effect |
|---------|----------|--------|
| `reservation.checked_in` | `InclusionsListeners` | Snapshot allowances; auto-issue amenity kits |
| `order.completed` | `InclusionsListeners` | Consume meal allowance for inclusion menu lines + `reservationId` |
| `order.completed` | `OrderEventsListener` | Inventory deduction + F&B revenue + COGS journals |
| Goods receipt / vendor payment | `AccountingListenersService` | AP / Inventory journals (procurement) |

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

## 11. Procurement

Vendors, purchase orders, goods receipt into inventory, and vendor payments. Scoped by **branch** (header required).

> **UI:** `/procurement` — **Vendors**, **Purchase orders**, **Vendor payments** tabs.

### Step 1: List or create a vendor

```bash
VENDOR_ID="00000000-0000-0000-0000-000000000001"   # Fresh Foods Ltd (seed)

curl -s "$BASE/procurement/vendors" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/procurement/vendors" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Metro Supplies","contactName":"Ali","email":"buy@metro.example"}' | jq
```

### Step 2: Create and submit a purchase order

```bash
curl -s -X POST "$BASE/procurement/purchase-orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorId": "'$VENDOR_ID'",
    "expectedDate": "2026-06-10",
    "lines": [
      { "inventoryItemId": "<rice-inv-id>", "quantity": 50, "unitPrice": 80 }
    ]
  }' | jq

curl -s -X POST "$BASE/procurement/purchase-orders/$PO_ID/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq
```

Statuses: `DRAFT` → `SUBMITTED` → `PARTIALLY_RECEIVED` → `RECEIVED`.

### Step 3: Receive goods

```bash
curl -s -X POST "$BASE/procurement/purchase-orders/$PO_ID/receive" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{"purchaseOrderLineId": "<line-id>", "quantity": 50}' | jq
```

**What happens:**

1. `PURCHASE` inventory movement (IN) for the line qty
2. Updates `receivedQty` on the PO line
3. Posts **Inventory Dr / AP Cr** when accounts 1200 and 2000 exist

### Step 4: Vendor payment

```bash
curl -s "$BASE/procurement/vendors/$VENDOR_ID/ap-balance?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq

curl -s -X POST "$BASE/procurement/vendor-payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorId": "'$VENDOR_ID'",
    "amount": 4000,
    "paymentDate": "2026-05-31",
    "payFromAccountCode": "1100",
    "reference": "CHK-1001"
  }' | jq
```

Posts **AP Dr / Bank Cr** (payment must not exceed outstanding AP for the vendor on the branch; respects open fiscal period).

---

## 12. Notifications

In-app alerts (header bell) and optional email (Resend when `RESEND_API_KEY` is set). Examples: low stock, report job completed, payroll failed.

### API

```bash
curl -s "$BASE/notifications/unread-count" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s "$BASE/notifications?limit=20" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X PATCH "$BASE/notifications/read-all" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s "$BASE/notifications/preferences" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X PATCH "$BASE/notifications/preferences/low_stock" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"inApp": true, "email": false}' | jq
```

**Settings → Notifications** tab configures per-type preferences for the current user.

---

## 13. Integrations (Channel Manager)

Connect OTAs and partner systems via **adapter-based connections**, inbound webhooks, and (for channel adapters) **availability export** and **manual blocks**. Admin-only (`ADMIN` permission). Configure under **Settings → Integrations**.

> **Deep references:** [phase2/integrations.md](phase2/integrations.md) (platform + webhooks), [phase2/channel-manager.md](phase2/channel-manager.md) (availability).

### Adapters

| Key | Use case |
|-----|----------|
| `channel_manager` | Preferred — `booking.import` + availability export/blocks |
| `ota_inquiry` | Legacy alias (same behavior as `channel_manager`) |
| `generic_webhook` | Log inbound payloads only (no PMS import) |

Channel adapters require a **branch** on the connection so imports and inventory are scoped correctly.

### Step 1: Platform health and adapter catalog

```bash
# Public — no auth
curl -s "$BASE/integrations/health" | jq

curl -s "$BASE/integrations/adapters" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

### Step 2: Create a channel connection

```bash
curl -s -X POST "$BASE/integrations/connections" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "adapterKey": "channel_manager",
    "name": "Demo OTA",
    "branchId": "'$BRANCH_ID'"
  }' | jq
```

**Save from the response:**

- `CONNECTION_ID` — used in webhook URL and API paths
- `webhookSecret` — shown **once** at create; store securely (rotate if lost)

**Webhook URL** (partners POST here):

```
POST $BASE/integrations/webhooks/$CONNECTION_ID
Header: X-Webhook-Secret: <webhookSecret>
```

Default public base: `http://localhost:3001/api` (set `PUBLIC_API_URL` in production).

```bash
curl -s "$BASE/integrations/connections" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

### Step 3: Rotate webhook secret

```bash
curl -s -X POST "$BASE/integrations/connections/$CONNECTION_ID/rotate-secret" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

Returns a new `webhookSecret` once; update the partner configuration.

### Step 4: Import booking (inbound webhook)

Simulate an OTA sending a new booking. Creates or reuses a guest by email, then a PMS **`INQUIRY`** reservation (does not block inventory until confirmed in PMS).

```bash
ROOM_ID="<vacant-room-uuid-from-availability>"

curl -s -X POST "$BASE/integrations/webhooks/$CONNECTION_ID" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "booking.import",
    "roomId": "'$ROOM_ID'",
    "checkIn": "2026-07-01",
    "checkOut": "2026-07-03",
    "guest": {
      "fullName": "Jane OTA Guest",
      "email": "jane.ota@example.com",
      "phone": "+8801711111111"
    },
    "adultCount": 2,
    "childCount": 0
  }' | jq
```

Review delivery log:

```bash
curl -s "$BASE/integrations/connections/$CONNECTION_ID/webhook-events?limit=20" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

Events progress: `RECEIVED` → `PROCESSED` or `FAILED` (with `errorMessage`).

### Step 5: Export availability

Pull nightly inventory by room type for a date range (max 366 nights). Counts subtract overlapping reservations (`INQUIRY`, `CONFIRMED`, `CHECKED_IN`), `MAINTENANCE` rooms, and manual blocks.

```bash
curl -s "$BASE/integrations/connections/$CONNECTION_ID/availability-export?from=2026-07-01&to=2026-07-08" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

**Expected shape (abridged):**

```json
{
  "connectionId": "int_…",
  "branchId": "00000000-0000-0000-0000-000000000001",
  "from": "2026-07-01",
  "to": "2026-07-08",
  "roomTypes": [
    {
      "roomTypeName": "Standard Double",
      "inventory": [
        { "date": "2026-07-01", "totalRooms": 4, "availableCount": 2, "blockedCount": 2 }
      ]
    }
  ]
}
```

Export is **pull-based** (UI preview or API). Live OTA push is future work.

### Step 6: Manual availability blocks

Close dates to channel sale without creating a reservation (e.g. renovation). Scope: whole branch, one **room type**, or one **room**.

```bash
curl -s "$BASE/integrations/connections/$CONNECTION_ID/availability-blocks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/integrations/connections/$CONNECTION_ID/availability-blocks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "roomTypeId": "00000000-0000-0000-0000-000000000010",
    "startDate": "2026-07-05",
    "endDate": "2026-07-07",
    "reason": "Renovation"
  }' | jq

curl -s -X DELETE "$BASE/integrations/connections/$CONNECTION_ID/availability-blocks/$BLOCK_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

### Step 7: Disable or delete a connection

```bash
curl -s -X PATCH "$BASE/integrations/connections/$CONNECTION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"DISABLED"}' | jq

curl -s -X DELETE "$BASE/integrations/connections/$CONNECTION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

### End-to-end OTA flow

```
Partner ──booking.import──► Webhook ──► INQUIRY reservation in PMS
                                    │
Front desk ──confirm──► CONFIRMED (blocks availability)

Admin ──availability-export──► Partner reads open inventory
Admin ──availability-blocks──► Partner sees reduced counts
```

After import, staff use **PMS → Reservations** to confirm, assign packages, check in, etc. ([Section 2](#2-property-management-system-pms)).

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

Key E2E specs: `pms.spec.ts`, `pms-flow.spec.ts`, `rates.spec.ts`, `pos.spec.ts`, `kitchen.spec.ts`, `inventory.spec.ts`, `procurement.spec.ts`, `accounting.spec.ts`, `hr.spec.ts`, `reports.spec.ts`, `settings.spec.ts`, `dashboard.spec.ts`, `notifications.spec.ts`, `audit.spec.ts`, `integrations.spec.ts`, `channel-manager.spec.ts`, `onboarding.spec.ts`, `branch-access.spec.ts`.

**Local smoke** (real API + DB): `pnpm test:smoke-local` — see [smoke-local.md](smoke-local.md).

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
| GET/POST | `/pms/rate-plans` | PMS_READ/WRITE | List/create rate plans |
| PATCH/DELETE | `/pms/rate-plans/:id` | PMS_WRITE | Update/delete plan |
| POST | `/pms/rate-plans/:id/rules` | PMS_WRITE | Add pricing rule |
| DELETE | `/pms/rate-plans/:planId/rules/:ruleId` | PMS_WRITE | Delete rule |
| GET | `/pms/pricing/quote` | PMS_READ | Stay price quote |

### Inclusions Endpoints

See [guest-inclusions-module.md](guest-inclusions-module.md).

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET/POST/PATCH | `/inclusions/packages` | PMS_READ/WRITE | Guest packages |
| GET/POST/PUT | `/inclusions/recipes` | PMS_READ/WRITE | Inclusion BOM |
| GET | `/inclusions/reservations/:id/allowances` | PMS_READ | Entitled vs consumed |
| POST | `/inclusions/reservations/:id/consume` | PMS_WRITE | Manual issue |
| POST | `/inclusions/reservations/:id/reconcile` | PMS_WRITE | Refresh snapshot |

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
| GET/POST/PATCH | `/inventory/pools`           | INVENTORY_*    | Org inventory pools    |

### Procurement Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET/POST | `/procurement/vendors` | INVENTORY_READ/WRITE | Vendor master |
| PATCH | `/procurement/vendors/:id` | INVENTORY_WRITE | Update vendor |
| GET/POST | `/procurement/purchase-orders` | INVENTORY_READ/WRITE | PO list/create |
| GET | `/procurement/purchase-orders/:id` | INVENTORY_READ | PO detail |
| POST | `/procurement/purchase-orders/:id/submit` | INVENTORY_WRITE | Submit PO |
| POST | `/procurement/purchase-orders/:id/receive` | INVENTORY_WRITE | Receive goods |
| GET | `/procurement/vendor-payments` | INVENTORY_READ | Payment list |
| GET | `/procurement/vendors/:id/ap-balance` | INVENTORY_READ | Outstanding AP |
| POST | `/procurement/vendor-payments` | ACCOUNTING_WRITE | Pay vendor |

### Accounting Endpoints

See [accounting-module.md](accounting-module.md) for curl examples.

| Method | Path                                | Permission        | Description            |
|--------|--------------------------------------|-------------------|------------------------|
| GET    | `/accounting/accounts`               | ACCOUNTING_READ  | List chart of accounts |
| POST   | `/accounting/accounts`               | ACCOUNTING_WRITE | Create account         |
| GET    | `/accounting/journals`               | ACCOUNTING_READ  | List journal entries   |
| POST   | `/accounting/journals`               | ACCOUNTING_WRITE | Create journal entry   |
| POST   | `/accounting/journals/:id/reverse`   | ACCOUNTING_WRITE | Reverse journal        |
| GET/POST | `/accounting/fiscal-periods`       | ACCOUNTING_*     | Fiscal periods         |
| PATCH  | `/accounting/fiscal-periods/:id/close` | ACCOUNTING_WRITE | Close period         |
| PATCH  | `/accounting/fiscal-periods/:id/reopen` | ACCOUNTING_WRITE | Reopen period       |

### HR & Payroll Endpoints

| Method | Path                                | Permission  | Description            |
|--------|--------------------------------------|------------|------------------------|
| GET    | `/hr/employees`                      | HR_READ    | List employees         |
| POST   | `/hr/employees`                      | HR_WRITE   | Create employee        |
| PATCH  | `/hr/employees/:id`                  | HR_WRITE   | Update or terminate employee |
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
| GET    | `/payroll/runs/:id/payslip`          | HR_READ    | Payslip PDF            |

### Tenants & Settings Endpoints

See [settings-module.md](settings-module.md), [organization-onboarding.md](organization-onboarding.md).

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET/POST | `/tenants/organizations` | — | List/create orgs |
| GET/PATCH | `/tenants/organizations/current` | ADMIN | Current org |
| GET/POST/PATCH/DELETE | `/tenants/branches` | ADMIN | Branch CRUD |
| GET/POST | `/tenants/invites` | ADMIN | Email invites |
| GET/POST | `/tenants/join-requests` | ADMIN | Approve/reject joins |
| GET/PATCH/DELETE | `/tenants/members` | ADMIN | Team CRUD |
| GET | `/audit/logs` | ADMIN | Audit trail |

### Integrations Endpoints

See [§13](#13-integrations-channel-manager), [phase2/integrations.md](phase2/integrations.md), [phase2/channel-manager.md](phase2/channel-manager.md).

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/integrations/health` | Public | Platform status |
| GET | `/integrations/adapters` | ADMIN | Adapter catalog |
| GET/POST/PATCH/DELETE | `/integrations/connections` | ADMIN | Connections |
| POST | `/integrations/connections/:id/rotate-secret` | ADMIN | New webhook secret |
| GET | `/integrations/connections/:id/webhook-events` | ADMIN | Delivery log |
| GET | `/integrations/connections/:id/availability-export` | ADMIN | OTA inventory export |
| GET/POST/DELETE | `/integrations/connections/:id/availability-blocks` | ADMIN | Close dates |
| POST | `/integrations/webhooks/:connectionId` | Webhook secret | Inbound partner payload |

### Notifications Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | List notifications |
| GET | `/notifications/unread-count` | Unread count |
| PATCH | `/notifications/read-all` | Mark all read |
| PATCH | `/notifications/:id/read` | Mark one read |
| GET/PATCH | `/notifications/preferences` | User preferences |

### Reporting Endpoints

| Method | Path                                | Permission    | Description            |
|--------|--------------------------------------|--------------|------------------------|
| GET    | `/reporting/dashboard?branchId=`     | REPORTS_READ | Dashboard metrics      |
| GET    | `/reporting/types`                   | REPORTS_READ | Export type catalog    |
| POST   | `/reporting/export`                  | REPORTS_READ | Request report export  |
| GET    | `/reporting/jobs`                    | REPORTS_READ | List report jobs       |

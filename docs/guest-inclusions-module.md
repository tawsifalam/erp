# Guest Inclusions Module

Tracks complimentary **meals per guest per night** and **amenity kits** (toiletries) for in-house stays. Packages define rules; check-in snapshots allowances; consumption deducts inventory.

## Concepts

| Entity | Scope | Purpose |
|--------|-------|---------|
| `InclusionRecipe` | Branch | BOM for one meal or one amenity kit |
| `InclusionPackage` | Organization | Named bundle of rules (e.g. Full board = 3 meals/night + kit) |
| `InclusionPackageRule` | Package | Meals/night, kits/stay, auto-issue on check-in |
| `ReservationAllowance` | Stay | Snapshot: entitled vs consumed at check-in |
| `InclusionConsumption` | Event | Manual, POS, or check-in auto-issue |

## Inventory pools

- **MEAL** recipes use the `guest` pool (kitchen).
- **AMENITY_KIT** recipes use the `housekeeping` system pool.
- Movements use `GUEST_INCLUSION` (OUT), reference `InclusionConsumption`.

## Entitlement formula

```
nights = calendar days between check-in and check-out (min 1)
guestCount = adultCount + childCount

MEAL entitled = nights × guestCount × (override ?? rule.quantityPerGuestPerNight)
AMENITY entitled = guestCount × rule.quantityPerGuestPerStay
```

## API (`/inclusions`)

| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PATCH | `/packages` | Org packages + rules |
| GET/POST/PUT | `/recipes?branchId=` | Branch BOM |
| GET | `/reservations/:id/allowances` | Entitled vs consumed |
| POST | `/reservations/:id/consume` | Manual meal/kit |
| POST | `/reservations/:id/reconcile` | Refresh snapshot (checked-in only) |

Permissions: `PMS_READ` / `PMS_WRITE`.

## Events

- **`reservation.checked_in`** — snapshot allowances, auto-issue amenity kits.
- **`order.completed`** — if order has `reservationId`, consume MEAL allowance for lines where `MenuItem.isGuestInclusionMeal`.

## UI

- **PMS → Guest packages** — recipes and packages admin.
- **PMS → Reservations** — adults, children, package, meal override; **Inclusions** panel when checked in.
- **POS → Menu** — “Guest inclusion meal” flag on items.
- **POS → Orders** — optional **Charge to room** for checked-in stays.

## Reservation fields

- `adultCount` (default 1), `childCount` (default 0)
- `packageId` (optional; default org package at snapshot)
- `mealsPerGuestPerNightOverride` (optional per-stay override)

## Future (out of scope)

- Rate plan pricing (roadmap 1.6c) — same `InclusionPackage` entity
- Child half-meal rates, folio/GL posting, per-item amenity tracking

See also: [PMS module](./pms-module.md), [POS module](./pos-module.md), [Inventory module](./inventory-module.md).

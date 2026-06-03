# Phase 2 — Channel manager

**Status:** Shipped (Sprint 8 — May 2026)  
**Builds on:** [integrations.md](./integrations.md) (Sprint 7)

## Goal

OTA/channel MVP on top of `IntegrationConnection`:

- **Export availability** — nightly inventory by room type from PMS reservations + manual blocks
- **Import bookings** — webhook `booking.import` → `INQUIRY` reservation (from Sprint 7)
- **Availability blocks** — close dates to channel sale without a reservation

Full rate parity and live OTA push are later; export is pull-based (admin UI or API).

## Adapters

| Key | Notes |
|-----|--------|
| `channel_manager` | Preferred for new connections |
| `ota_inquiry` | Legacy alias — same channel APIs and webhooks |

Both require a **branch** on the connection.

## Data model

### `ChannelAvailabilityBlock`

| Field | Purpose |
|-------|---------|
| `organizationId` | Tenant |
| `branchId` | Branch scope (required) |
| `connectionId` | Optional link to integration connection |
| `roomId` | Optional — block one room |
| `roomTypeId` | Optional — block all rooms of type |
| *(neither)* | Block entire branch for date range |
| `startDate` / `endDate` | Inclusive dates (`YYYY-MM-DD`) |
| `reason` | Optional label (e.g. renovation) |

**Inventory calculation** (per night, per room type):

- `totalRooms` — rooms on branch not in `MAINTENANCE`
- Subtract rooms with overlapping `INQUIRY`, `CONFIRMED`, or `CHECKED_IN` reservations
- Subtract rooms matching an active `ChannelAvailabilityBlock`

## API

All routes require `ADMIN` and `X-Organization-Id`. Connection must use a channel adapter and have `branchId`.

| Method | Path | Action |
|--------|------|--------|
| GET | `/integrations/connections/:id/availability-export?from=&to=` | JSON export (`from` / `to` exclusive end, max 366 nights) |
| GET | `/integrations/connections/:id/availability-blocks` | List blocks (connection + branch-wide) |
| POST | `/integrations/connections/:id/availability-blocks` | Create block |
| DELETE | `/integrations/connections/:id/availability-blocks/:blockId` | Remove block |
| POST | `/integrations/webhooks/:connectionId` | `booking.import` (see [integrations.md](./integrations.md)) |

**Export response (excerpt):**

```json
{
  "connectionId": "int_…",
  "branchId": "br_…",
  "from": "2026-07-01",
  "to": "2026-07-08",
  "exportedAt": "2026-05-31T12:00:00.000Z",
  "roomTypes": [
    {
      "roomTypeId": "rt_…",
      "roomTypeName": "Standard Double",
      "inventory": [
        { "date": "2026-07-01", "totalRooms": 5, "availableCount": 3, "blockedCount": 2 }
      ]
    }
  ]
}
```

## UI

**Settings → Integrations** — when a **channel** connection is selected:

- Date range + **Export availability** (preview table)
- **Manual availability blocks** (add / remove)
- Webhook URL + secret (Sprint 7)

Create connections with adapter **Channel manager** and assign a **branch**.

## Tests

| Suite | Coverage |
|-------|----------|
| API unit | `channel-manager.service.spec.ts` — export, blocks, adapter guard |
| API unit | `integrations.service.spec.ts` — `booking.import` on channel adapters |
| E2E (mock) | `channel-manager.spec.ts` — export + block |
| E2E (mock) | `integrations.spec.ts` — registry includes `channel_manager` |
| Smoke (real) | `smoke-local-01` — create channel connection, export availability |

## Migration

`20260616100000_channel_availability_blocks`

## Next

- Push availability to OTAs (scheduled job / partner API)
- Link `config.linkedRatePlanId` for rate parity
- iCal feed format on export
- [Multi-property analytics](./multi-property-analytics.md)

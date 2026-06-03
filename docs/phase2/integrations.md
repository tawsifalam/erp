# Phase 2 — Integrations platform

**Status:** Shipped (Sprint 7 — May 2026)  
**Deferred from:** Phase 1 ([README](./README.md) § Integrations platform)

## Goal

Replace the `GET /integrations/health` stub with an **adapter registry**, **org-scoped connections** (credentials + config), and **inbound webhooks** with delivery logging. Provides the foundation for [channel manager](./channel-manager.md) (OTA sync).

## Adapter registry

Built-in adapters (code constants in `integration-adapters.constants.ts`):

| Key | Name | Webhook events | Behavior |
|-----|------|----------------|----------|
| `generic_webhook` | Generic webhook | `*` | Log payload only |
| `ota_inquiry` | OTA inquiry (stub) | `booking.import` | Create PMS `INQUIRY` reservation |

## Data model

### `IntegrationConnection`

| Field | Purpose |
|-------|---------|
| `organizationId` | Tenant scope |
| `branchId` | Optional; required for OTA inquiry imports |
| `adapterKey` | Registry key |
| `name` | Admin label |
| `status` | `ACTIVE` \| `DISABLED` |
| `webhookSecret` | Validates `X-Webhook-Secret` on inbound POST |
| `credentialsJson` | Adapter credentials (masked in API responses) |
| `configJson` | Optional adapter config |

### `IntegrationWebhookEvent`

| Field | Purpose |
|-------|---------|
| `connectionId` | Source connection |
| `eventType` | From payload `event` (or `unknown`) |
| `payload` | Raw JSON body |
| `status` | `RECEIVED` → `PROCESSED` \| `FAILED` |
| `errorMessage` | Set when processing fails |

## API

| Method | Path | Permission | Action |
|--------|------|------------|--------|
| GET | `/integrations/health` | Public | Platform status + adapter count |
| GET | `/integrations/adapters` | `ADMIN` | List adapter registry |
| GET | `/integrations/connections` | `ADMIN` | List connections (masked credentials) |
| POST | `/integrations/connections` | `ADMIN` | Create; returns **full** `webhookSecret` once |
| PATCH | `/integrations/connections/:id` | `ADMIN` | Update name, status, branch, credentials |
| DELETE | `/integrations/connections/:id` | `ADMIN` | Remove connection + events |
| POST | `/integrations/connections/:id/rotate-secret` | `ADMIN` | New secret (returned once) |
| GET | `/integrations/connections/:id/webhook-events` | `ADMIN` | Recent delivery log |
| POST | `/integrations/webhooks/:connectionId` | **Webhook secret** | Inbound partner payload |

**Webhook auth:** header `X-Webhook-Secret: <webhookSecret>` (no JWT).

**OTA `booking.import` body:**

```json
{
  "event": "booking.import",
  "roomId": "<uuid>",
  "checkIn": "2026-07-01",
  "checkOut": "2026-07-03",
  "guest": { "fullName": "Jane Doe", "email": "jane@ota.com", "phone": "+880..." },
  "adultCount": 2,
  "childCount": 0
}
```

Creates or reuses guest by email, then `PmsService.createReservation` with `INQUIRY`.

**Webhook URL:** `{PUBLIC_API_URL}/api/integrations/webhooks/{connectionId}` (default `http://localhost:3001`).

## UI

**Settings → Integrations** (admin):

- Connections table (enable/disable, rotate secret, delete)
- Webhook URL + secret preview for selected connection
- Recent webhook events
- Adapter registry reference

## Tests

| Suite | Coverage |
|-------|----------|
| API unit | `integrations.service.spec.ts` — adapters, create, webhook auth, OTA import |
| E2E (mock) | `integrations.spec.ts` — create connection, webhook log, disable |
| Smoke (real) | `smoke-local-01` — integrations tab + adapter registry |

## Migration

`20260615100000_integration_connections`

## Next

**Channel manager** — availability export, rate parity, full OTA adapters on top of connections — [channel-manager.md](./channel-manager.md).

# Phase 2 — Notification preferences

**Status:** Shipped (Sprint 5 — May 2026)  
**Deferred from:** Phase 1 ([README](./README.md) § Governance, notifications & audit)

## Goal

Per-user, per-organization toggles for **in-app** and **email** delivery by notification event type.

## Data model

`NotificationPreference`:

| Field | Purpose |
|-------|---------|
| `organizationId` | Scoped to current org |
| `userId` | The signed-in user |
| `type` | Event type (`LOW_STOCK`, `REPORT_READY`, …) |
| `inApp` | Create in-app notification row |
| `email` | Queue BullMQ email job |

Unique on `(organizationId, userId, type)`.

When no row exists, **defaults** apply (matching Phase 1 behavior):

| Type | In-app | Email |
|------|--------|-------|
| `LOW_STOCK` | ✓ | ✓ |
| `PAYROLL_COMPLETED` | ✓ | ✓ |
| `PAYROLL_FAILED` | ✓ | ✓ |
| `REPORT_READY` | ✓ | — |
| `PO_AWAITING_RECEIPT` | ✓ | — |

## API

| Method | Path | Action |
|--------|------|--------|
| GET | `/notifications/preferences` | List all types with merged defaults |
| PATCH | `/notifications/preferences/:type` | Update `{ inApp?, email? }` |

At least one channel is not required — users can mute an event type entirely (both channels off).

`NotificationsService.notifyUser` resolves preferences before creating rows or queuing email. Hard-coded `email: true/false` on callers was removed.

## UI

**Settings → Notifications** tab (all org members, not admin-only):

- Table of event types with in-app / email checkboxes
- Saves on toggle

## Tests

| Suite | Coverage |
|-------|----------|
| API unit | `notifications.service.spec.ts` — resolve, notify, update |
| E2E (mock) | `notification-preferences.spec.ts` — toggle blocks bell |
| Smoke (real) | `smoke-local-01` — preferences tab visible |

## Migration

`20260613100000_notification_preferences`

## Next (Sprint 6)

**Branch invitations** — per-branch membership ([README](./README.md) § Organization & access).

# Phase 2 — Branch invitations (branch access)

**Status:** Shipped (Sprint 6 — May 2026)  
**Deferred from:** Phase 1 ([README](./README.md) § Organization & access)

## Goal

**Branch-scoped membership** — org members only see and use branches they are granted access to. Owners and admins retain access to all branches.

## Data model

`UserBranch`:

| Field | Purpose |
|-------|---------|
| `organizationId` | Denormalized for queries |
| `userId` | Org member |
| `branchId` | Target branch |
| `status` | `ACTIVE` (MVP); `PENDING` reserved for self-request flow |
| `grantedByUserId` | Admin who granted access |
| `approvedAt` | When access became active |

Unique on `(userId, branchId)`.

**Migration backfill:** existing org members receive `ACTIVE` grants for all branches in their org (no lockout on upgrade).

**Implicit access:** `OWNER` and `ADMIN` org roles — no `UserBranch` row required.

## API

| Method | Path | Permission | Action |
|--------|------|------------|--------|
| GET | `/tenants/branches/:branchId/members` | `ADMIN` | List org members with access flags |
| POST | `/tenants/branches/:branchId/members` | `ADMIN` | Grant `{ userId }` |
| DELETE | `/tenants/branches/:branchId/members/:userId` | `ADMIN` | Revoke grant |

`GET /tenants/organizations` returns **filtered branches** per membership (accessible only).

## Guards

`TenantGuard` — when `X-Branch-Id` is set:

1. Branch must belong to `X-Organization-Id`
2. User must be OWNER/ADMIN **or** have `ACTIVE` `UserBranch` row

Returns **403** otherwise.

## UI

**Settings → Branch access** (admin):

- Branch picker
- Table of org members: org role, access status, Grant / Revoke

**Header branch selector** — only lists branches returned from `/tenants/organizations` (already filtered server-side).

## Tests

| Suite | Coverage |
|-------|----------|
| API unit | `tenants.service.spec.ts` — grant, revoke, filtered org list |
| E2E (mock) | `branch-access.spec.ts` — grant on Annex Branch |
| Smoke (real) | `smoke-local-01` — branch access tab visible |

## Migration

`20260614100000_user_branch`

## Next

**Channel manager** — builds on [integrations.md](./integrations.md) — see [README](./README.md).

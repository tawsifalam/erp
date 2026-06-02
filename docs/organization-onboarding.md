# Organization onboarding

Mandatory organization onboarding after PropelAuth login. Users must **create an organization** or **request to join** one before accessing ERP modules. Join requests require OWNER/ADMIN approval with an assigned **org role**.

Related: [PropelAuth](propelauth.md), [Tenant model](tenant-model.md), [Settings — Team & access](settings-module.md).

## Overview

| Layer | Responsibility |
|-------|----------------|
| **PropelAuth** | Login, JWT, session |
| **ERP PostgreSQL** | Organizations, branches, `UserOrganization.role`, join requests |
| **Web gate** | Blocks `(erp)` routes until active membership |
| **API guards** | `TenantGuard` + `@RequirePermission()` on module routes |
| **UI RBAC** | Sidebar and route guards filter by role permissions |

PropelAuth org IDs are **not** the source of tenant membership. ERP onboarding is authoritative.

## User journeys

### Create organization

1. User signs in via PropelAuth.
2. `POST /api/auth/sync` upserts the ERP user only (no auto org).
3. User lands on `/onboarding` → **Create organization** (name, timezone).
4. `POST /api/tenants/organizations` creates org, `joinCode`, Main Branch, inventory pools, and `UserOrganization` with role `OWNER`.
5. User is redirected to `/dashboard` (or role default route).

### Invite by email (admin)

1. OWNER/ADMIN opens **Settings → Team & access** → **Invite by email** (email + ERP role).
2. API calls PropelAuth `inviteUserToOrg` and stores a pending `OrganizationInvite`.
3. Recipient completes PropelAuth signup from the email link.
4. On `POST /auth/sync`, pending invites for that email create `UserOrganization` with the assigned role (no manual approval).

Join-by-code remains available for staff who cannot be invited directly.

### Join by search or join code

1. User opens `/onboarding` → **Join organization**.
2. Search by name (`GET /tenants/organizations/search?q=`) or enter join code (`GET /tenants/organizations/by-join-code/:code`).
3. `POST /tenants/join-requests` creates a `PENDING` request.
4. User waits on `/onboarding/pending` (polls status every 15s).
5. OWNER/ADMIN approves in **Settings → Team & access** with a required role (default `FRONT_DESK`).
6. `UserOrganization` is created; user gains app access on next status check.

### Approve / reject

Admins see pending requests in Settings. Approve requires selecting a role from: `FRONT_DESK`, `CASHIER`, `KITCHEN`, `ACCOUNTANT`, `HR`, `ADMIN` (use elevated roles deliberately — never default to ADMIN).

## Onboarding state machine

| State | Can access | UI |
|-------|------------|-----|
| Logged in, no membership, no pending request | `/auth/*`, `/onboarding` | Create or join |
| Pending join request | `/auth/*`, `/onboarding`, `/onboarding/pending` | Waiting screen |
| Rejected (no pending) | `/onboarding` | Retry join or create org |
| Active membership | Role-scoped ERP routes | Normal app |

## Org roles & RBAC

Role is stored on `UserOrganization.role` (org-scoped, ERP-managed).

| Role | Key permissions | Sidebar (Phase 1) | Default route |
|------|-----------------|-------------------|---------------|
| `OWNER` / `ADMIN` | All | Full app + Settings | `/dashboard` |
| `FRONT_DESK` | `pms:read`, `pms:write` | PMS only | `/pms` |
| `CASHIER` | PMS read + POS | PMS, POS | `/pos` |
| `KITCHEN` | POS | POS, Kitchen | `/pos/kitchen` |
| `ACCOUNTANT` | Accounting, reports, … | Back office modules | `/accounting` |
| `HR` | HR, reports | HR, Reports | `/hr` |

Permission matrix: `packages/utils/src/rbac.ts`.

Nav items map to permissions in `apps/web/src/components/nav-config.tsx`. Unauthorized deep links redirect via `RouteGuard` to `getDefaultRouteForRole()`.

## API reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/tenants/onboarding/status` | JWT | `{ hasMembership, canAccessApp, pendingRequest }` |
| GET | `/tenants/organizations/search?q=` | JWT | Org directory (min 2 chars, limit 20) |
| GET | `/tenants/organizations/by-join-code/:code` | JWT | Resolve org by join code |
| POST | `/tenants/organizations` | JWT | Create org (first org: no admin; additional: OWNER/ADMIN) |
| POST | `/tenants/join-requests` | JWT | `{ organizationId \| joinCode, message? }` |
| DELETE | `/tenants/join-requests/:id` | JWT | Cancel own pending request |
| GET | `/tenants/join-requests/mine` | JWT | Request history |
| GET | `/tenants/join-requests` | JWT + tenant + admin | Pending for current org |
| POST | `/tenants/join-requests/:id/approve` | JWT + tenant + admin | Body: `{ role }` required |
| POST | `/tenants/join-requests/:id/reject` | JWT + tenant + admin | Body: `{ reason? }` |
| GET | `/tenants/invites` | JWT + tenant + admin | Pending email invites |
| POST | `/tenants/invites` | JWT + tenant + admin | Body: `{ email, role }` — PropelAuth email invite |
| POST | `/tenants/invites/:id/revoke` | JWT + tenant + admin | Revoke pending invite |
| GET | `/tenants/members` | JWT + tenant + admin | Active members + roles |
| PATCH | `/tenants/members/:userId/role` | JWT + tenant + admin | Change role (not last OWNER) |

### Example: onboarding status

```json
{
  "hasMembership": false,
  "canAccessApp": false,
  "pendingRequest": {
    "id": "ojr_…",
    "organizationId": "org_…",
    "organizationName": "Boulevard Café",
    "createdAt": "2026-05-29T12:00:00.000Z"
  }
}
```

### Example: approve join request

```http
POST /api/tenants/join-requests/{id}/approve
X-Organization-Id: {orgUuid}
Authorization: Bearer …

{ "role": "FRONT_DESK" }
```

## Web routes

| Route | Purpose |
|-------|---------|
| `/onboarding` | Create org or request to join |
| `/onboarding/pending` | Waiting for admin approval |
| `(erp)/*` | Gated by `TenantGate` + `RouteGuard` |

`TenantGate` calls `/tenants/onboarding/status` after `POST /auth/sync`. Middleware allows `/onboarding` for authenticated users.

## Security

- No ERP module data without active `UserOrganization`.
- API returns **403** without required permission (UI hiding is defense in depth).
- Org search exposes **name + id** only; private onboarding can use join codes.
- Rate-limit search in production (recommended).

## Migration notes

Fresh installs use a single init migration that includes `joinCode` and `OrganizationJoinRequest`.

**Reset local database** (drops all data, reapplies init migration, runs seed):

```bash
pnpm db:reset
```

Use this when developing from scratch instead of applying incremental migrations. On production, use `prisma migrate deploy` only if you have existing data to preserve.

## Phase 2 — Branch access (shipped)

| Concept | Implementation |
|---------|----------------|
| **Model** | `UserBranch` with `status: ACTIVE` |
| **Scope** | Non-admin org members only see granted branches |
| **Flow** | Admin grants / revokes under Settings → Branch access |
| **Guards** | `TenantGuard` checks branch access when `X-Branch-Id` set |

See [phase2/branch-invitations.md](./phase2/branch-invitations.md).

Phase 1 roles remain **org-wide** for permissions (e.g. FRONT_DESK role); branch access controls **which properties** they can work in.

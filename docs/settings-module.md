# Settings module reference

Organization, branch, and inventory pool configuration for phase 1.

## Scope

| Feature | Scoped by | Notes |
|---------|-----------|-------|
| Organization rename | Organization | Display name in ERP database |
| Branch CRUD | Organization | Name + IANA timezone |
| Inventory pools | Organization | Guest/staff defaults + custom pools |
| Header tenant switch | User membership | All modules use selected org/branch |

Web UI: `/settings` (sidebar). Management actions require **OWNER** or **ADMIN**.

## Web UI tabs

### Organization & branches

| Action | What it does |
|--------|----------------|
| **Create organization** | Inserts `Organization`, default "Main Branch", `UserOrganization` as OWNER, and seeds guest/staff inventory pools |
| **Rename organization** | Updates display `name`; refreshes header memberships |
| **Add branch** | Creates a new `Branch` under the current organization |
| **Edit branch** | Updates branch `name` and `timezone` inline |
| **Delete branch** | Permanently removes a branch after confirmation; disabled for the only branch; blocked by API if active reservations exist |

Non-admin users see a read-only notice and can still switch org/branch from the header.

### Team & access

| Action | What it does |
|--------|----------------|
| **Invite by email** | PropelAuth org invite + pending ERP invite with assigned role; membership on first login sync |
| **Revoke invite** | Cancels PropelAuth pending invite and marks ERP invite `REVOKED` |
| **View join code** | Copy org `joinCode` for staff onboarding (MVP self-serve join) |
| **Approve join request** | Creates `UserOrganization` with selected role (required) |
| **Reject join request** | Marks request rejected |
| **Change member role** | Updates `UserOrganization.role` (cannot demote last OWNER) |
| **Remove member** | Deletes membership for invited/joined members; **founder cannot be removed** |

See [Organization onboarding](organization-onboarding.md) for the full join flow and role matrix.

### Inventory pools

Configure stock pools (see [Inventory module](inventory-module.md)). System pools `guest` and `staff` are seeded on org create and cannot be deleted.

| Action | What it does |
|--------|----------------|
| **Add pool** | Custom pool with text `code` slug and display name |
| **Rename pool** | Update display name |
| **Activate / deactivate** | Toggle `isActive` (non-system pools only) |

## API

Base path: `/api/tenants`. Requires `Authorization`. Branch/org mutations require `X-Organization-Id` and `admin:*` permission.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/tenants/organizations` | List user memberships (header dropdowns) |
| POST | `/tenants/organizations` | Create org + Main Branch + OWNER + default pools |
| GET | `/tenants/organizations/current` | Current org with branches |
| PATCH | `/tenants/organizations/current` | Rename organization |
| GET | `/tenants/branches` | List branches |
| POST | `/tenants/branches` | Create branch |
| PATCH | `/tenants/branches/:id` | Update branch |
| DELETE | `/tenants/branches/:id` | Delete branch (not last; no active reservations) |
| GET | `/tenants/members` | List members + roles |
| PATCH | `/tenants/members/:userId/role` | Change member role |
| DELETE | `/tenants/members/:userId` | Remove member (not the founder) |
| GET | `/tenants/invites` | Pending email invites |
| POST | `/tenants/invites` | Send email invite `{ email, role }` |
| POST | `/tenants/invites/:id/revoke` | Revoke pending invite |
| GET | `/tenants/join-requests` | Pending join requests (admin) |
| POST | `/tenants/join-requests/:id/approve` | Approve with `{ role }` |
| POST | `/tenants/join-requests/:id/reject` | Reject request |

Onboarding endpoints: see [Organization onboarding](organization-onboarding.md).

Inventory pools: `/api/inventory/pools` (documented in [Inventory module](inventory-module.md)).

### Validation

| Field | Rule |
|-------|------|
| Organization name | Required, trimmed on create/update |
| Branch name | Required, trimmed on create/update |
| Timezone | Required on create; trimmed IANA string |
| Pool code | Lowercase slug, unique per org (inventory API) |

Empty strings return `400 Bad Request`.

**Delete branch guardrails:**

| Condition | HTTP status |
|-----------|---------------|
| Branch not in current org | `404` |
| Last branch in organization | `400` |
| Active reservations (INQUIRY, CONFIRMED, CHECKED_IN) | `409` |

Successful delete cascades rooms, reservations, POS, inventory, and related branch-scoped data. Employee and report job references are cleared before delete.

## Permissions

| Role | Settings management |
|------|---------------------|
| OWNER | Full |
| ADMIN | Full |
| Others | Header switch only |

## Related docs

- [Tenant model](tenant-model.md) — hierarchy, headers, RBAC
- [App Workflow Guide §1b](app-workflow-guide.md#1b-organization--branch-management) — curl examples
- [App Workflow Guide §13](app-workflow-guide.md#13-integrations-channel-manager) — OTA connections, webhooks, availability
- [Inventory module](inventory-module.md) — pools, items, movements

## Tests

| Layer | Location |
|-------|----------|
| Unit | `apps/api/src/tenants/tenants.service.spec.ts` |
| E2E (mocked API) | `apps/web/e2e/settings.spec.ts` |
| Local smoke (real stack) | `apps/web/e2e/smoke-local-01-settings.spec.ts` — see [smoke-local.md](./smoke-local.md) |

```bash
pnpm --filter @erp/api test -- tenants
pnpm --filter @erp/web test:e2e settings
pnpm --filter @erp/web test:smoke-local -- smoke-local-01-settings
```

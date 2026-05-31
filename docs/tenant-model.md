# Tenant model

## Hierarchy

- **Organization** — maps to PropelAuth org (`propelAuthOrgId`); includes shareable `joinCode` for onboarding
- **Branch** — property/location within an org
- **User** — maps to PropelAuth user; linked via `UserOrganization` with a `Role`

New users must complete [organization onboarding](organization-onboarding.md) (create org or approved join request) before accessing ERP modules. UI navigation is filtered by org role — see onboarding doc § Org roles & RBAC.

## Request context

The API `TenantGuard` reads:

| Header | Purpose |
|--------|---------|
| `X-Organization-Id` | Required on tenant-scoped routes (internal ERP UUID) |
| `X-Branch-Id` | Required for branch operations (PMS, POS, inventory) |

The guard verifies membership and attaches `request.tenant`:

```ts
{ organizationId, branchId?, userId, role }
```

## RBAC

Roles: `OWNER`, `ADMIN`, `FRONT_DESK`, `CASHIER`, `KITCHEN`, `ACCOUNTANT`, `HR`.

Permissions are checked via `@RequirePermission()` and `roleHasPermission()` in `@erp/utils`.

See `packages/utils/src/rbac.ts` for the matrix.

## Managing organizations & branches

| Surface | Purpose |
|---------|---------|
| **Web → Settings** (`/settings`) | Create organizations, rename org, add/edit branches, **Team & access** (join requests, members, join code), inventory pools (OWNER / ADMIN) |
| **Header selectors** | Switch active org/branch for all modules; persisted in `localStorage` (`erp:tenant`) |
| **API → `/api/tenants`** | CRUD for branches; create org; PATCH org name |

After changing branches in Settings, call `refreshMemberships()` so header dropdowns include new branches.

How each module scopes data is documented in [App Workflow Guide — §1b](app-workflow-guide.md#1b-organization--branch-management). Full Settings reference: [Settings module](settings-module.md).

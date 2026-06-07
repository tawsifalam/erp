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

## Branch resolution and FK validation

Tenant isolation is enforced in the **application layer** (no Prisma middleware). Use [`TenantScopeService`](apps/api/src/common/tenant/tenant-scope.service.ts) for all branch-scoped routes.

### Resolving `branchId`

Never use `branchId || t.branchId!` from raw query/body. Call:

```ts
await this.tenantScope.resolveBranchId(tenant, queryOrBodyBranchId);
```

This validates:

1. Branch belongs to `tenant.organizationId`
2. Non-admin roles (`FRONT_DESK`, `CASHIER`, etc.) have an **active** `UserBranch` grant

`TenantGuard` validates the **header** `X-Branch-Id` only; query/body overrides must go through `resolveBranchId`.

### Foreign-key assertions on writes

When a request references another entity by UUID, assert it belongs to the tenant before create/update:

| Helper | Use when |
|--------|----------|
| `assertGuestInOrganization` | `guestId` on reservations |
| `assertRoomTypeInOrganization` | `roomTypeId` on rooms / availability |
| `assertRoomInBranch` | `roomId` on branch-scoped PMS flows |
| `assertRoomInOrganization` | `roomId` on org-scoped reads (e.g. pricing quote) |
| `assertMenuItemInBranch` | POS order lines |
| `assertAccountsInOrganization` | Journal entry lines |
| `assertEmployeeInOrganization` | HR employee references |

Throw `NotFoundException` for cross-tenant IDs (avoid org enumeration).

### Checklist for new modules

1. Inject `TenantScopeService` in the controller or service.
2. Resolve branch via `resolveBranchId` when the route accepts `branchId`.
3. Validate all incoming FK UUIDs with the appropriate `assert*` helper.
4. Add unit tests for foreign-ID rejection; add E2E isolation cases when the route is user-facing.

### Testing

| Layer | Command |
|-------|---------|
| Unit | `cd apps/api && pnpm test:unit` |
| Mock API E2E | `cd apps/web && npx playwright test e2e/tenant-isolation.spec.ts` |
| Real-stack smoke | `pnpm smoke:local -- e2e/smoke-local-08-tenant-isolation.spec.ts` (branch-grant denial when `SMOKE_PROPELAUTH_FRONT_DESK_USER_ID` is set) |
| API integration (2 orgs in PostgreSQL) | `RUN_INTEGRATION=1 cd apps/api && pnpm test:integration` |

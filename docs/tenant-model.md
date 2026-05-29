# Tenant model

## Hierarchy

- **Organization** — maps to PropelAuth org (`propelAuthOrgId`)
- **Branch** — property/location within an org
- **User** — maps to PropelAuth user; linked via `UserOrganization` with a `Role`

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

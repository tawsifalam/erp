# Test coverage gaps

Living checklist from the [test audit](../README.md#testing). Update when closing items.

## Automated in CI

| Check | Command | Status |
|-------|---------|--------|
| Unit (API, web lib, utils) | `pnpm test` | ✅ `ci` job |
| E2E (mocked API) | `pnpm test:e2e -- --project=chromium` | ✅ `e2e` job |

## Unit tests — API

| Area | Status | Notes |
|------|--------|-------|
| Inventory weighted average (PURCHASE) | ✅ | `inventory.service.spec.ts` |
| `AuditService` record/list | ✅ | `audit.service.spec.ts` |
| `RatePlansService` validation | ✅ | `rate-plans.service.spec.ts` |
| `ReportGeneratorsService` branch CSVs | ✅ | `report-generators.service.spec.ts` |
| `EmailService` (no-key log + Resend) | ✅ | `email.service.spec.ts` |
| `StorageService` upload/download | ✅ | `storage.service.spec.ts` |
| `PropelAuthService` adapter | ✅ | `propelauth.service.spec.ts` |
| `UsersService` | ✅ | `users.service.spec.ts` |

## Unit tests — web & packages

| Area | Status | Notes |
|------|--------|-------|
| `apiFetchBlob` | ✅ | `api-client.test.ts` |
| `socket.ts` join helpers | ✅ | `socket.test.ts` |
| `decimal` helpers | ✅ | `packages/utils/src/decimal.test.ts` |

## Tenant isolation

| Layer | Status | Notes |
|-------|--------|-------|
| API unit (`TenantScopeService`, guards, controllers) | ✅ | `pnpm --filter @erp/api test:unit` |
| API integration (2-org PostgreSQL) | ✅ | `RUN_INTEGRATION=1 pnpm --filter @erp/api test:integration` — 12 cases |
| Mock E2E isolation | ✅ | `e2e/tenant-isolation.spec.ts` (org + branch guards, mutations, admin routes) |
| Real-stack smoke isolation | ✅ | `smoke-local-08` (+ optional branch-grant user) |

## E2E (mocked)

| Area | Status | Notes |
|------|--------|-------|
| General ledger export UI | ✅ | `reports.spec.ts` |
| RBAC — FRONT_DESK, CASHIER, KITCHEN | ✅ | `onboarding.spec.ts` |
| RBAC — ACCOUNTANT, HR | ✅ | `onboarding.spec.ts` |
| Join code — applicant + admin approve | ✅ | `join-code.spec.ts` |
| Payslip PDF fetch | ✅ | `hr.spec.ts` (API response) |
| Socket.IO live kitchen push | ☐ | Covered by API-driven KDS tests; live push needs real stack |

## Smoke-local / production runbook (manual)

| Runbook | Status | Notes |
|---------|--------|-------|
| §1 Email invite E2E | ☐ | Requires PropelAuth email + second account |
| §2 Join code approval (real 2nd user) | ☐ | Mocked in `join-code.spec.ts`; production still manual |
| §5.5 Payslip PDF open in viewer | ☐ | E2E asserts PDF response only |
| §8.3 Notification email | ☐ | `RESEND_API_KEY` + inbox |
| §7 CSV/PDF content validation | ☐ | Debits = credits, file contents |
| Socket.IO deep check | ☐ | Optional appendix; use `pnpm smoke:local` |

See [smoke-local.md](./smoke-local.md) for automated smoke matrix.

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
| `email.service` / `storage.service` | ☐ | Resend + MinIO paths |
| `propelauth.service` | ☐ | External adapter |
| `users.service` | ☐ | Thin list helper |

## E2E (mocked)

| Area | Status | Notes |
|------|--------|-------|
| General ledger export UI | ✅ | `reports.spec.ts` |
| RBAC — FRONT_DESK | ✅ | `onboarding.spec.ts` |
| RBAC — CASHIER, KITCHEN | ✅ | `onboarding.spec.ts` |
| Join code approval (2 users) | ☐ | Needs second mock identity |
| Socket.IO kitchen realtime | ☐ | Requires real API + Redis |
| Payslip PDF download | ☐ | MinIO + completed payroll |

## Smoke-local / production runbook (manual)

| Runbook | Status | Notes |
|---------|--------|-------|
| §1 Email invite E2E | ☐ | Second PropelAuth user |
| §2 Join code approval | ☐ | Second user |
| §5.5 Payslip PDF | ☐ | Optional deep check |
| §8.3 Notification email | ☐ | `RESEND_API_KEY` |
| §7 CSV/PDF content validation | ☐ | Debits = credits, file open |
| RBAC matrix (all roles) | ☐ | Partial via mocked E2E |
| Socket.IO deep check | ☐ | Optional appendix |

See [smoke-local.md](./smoke-local.md) for automated smoke matrix.

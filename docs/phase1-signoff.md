# Phase 1 sign-off

**Status:** Complete (operations MVP + Phase 1.5 finance/supply chain + Phase 1.6 control plane)  
**Sign-off date:** February 2026  
**Authority:** Internal “complete hospitality ERP” bar per [erp-completeness-roadmap.md](./erp-completeness-roadmap.md)

This document is the frozen record of what shipped in Phase 1. Use it for onboarding, production soak, and Phase 2 planning.

---

## What “Phase 1 complete” means

A property group can run **without spreadsheets** for:

| Pillar | Capability |
|--------|------------|
| **Operations** | PMS (rooms, guests, reservations, rates, housekeeping), POS/kitchen, guest inclusion packages |
| **Supply chain** | Vendors → PO → receive → inventory; weighted-average costing → COGS |
| **Finance** | Double-entry GL, auto-posting (PMS/POS/payroll/procurement), financial CSV exports |
| **People** | HR, attendance, staff meals, payroll runs with payslip PDF |
| **Governance** | Audit log, team roles, PropelAuth email invite + join-code onboarding, in-app/email notifications |

**Not required for this bar:** OTA/channel manager, offline POS, mobile app, fiscal period close, vendor payment runs, SaaS billing.

---

## Delivered by phase

### Phase 1 — Operations MVP

| Module | Route / API | Doc |
|--------|-------------|-----|
| Settings | `/settings` | [settings-module.md](./settings-module.md) |
| Onboarding | `/onboarding` | [organization-onboarding.md](./organization-onboarding.md) |
| PMS | `/pms` | [pms-module.md](./pms-module.md) |
| POS | `/pos`, `/pos/kitchen` | [pos-module.md](./pos-module.md) |
| Inventory | `/inventory` | [inventory-module.md](./inventory-module.md) |
| Accounting | `/accounting` | [accounting-module.md](./accounting-module.md) |
| HR / payroll | `/hr` | [hr-module.md](./hr-module.md) |
| Reporting | `/reports`, `/dashboard` | [reporting-module.md](./reporting-module.md) |

### Phase 1.5 — Finance & supply chain

| ID | Deliverable | Key evidence |
|----|-------------|--------------|
| 1.5a | Procurement | `/procurement`, `ProcurementService.receiveGoods` → `postGoodsReceipt` |
| 1.5b | Weighted-average costing | `InventoryItem.averageUnitCost`, COGS from average in recipes/POS |
| 1.5c | Financial reports | `trial_balance`, `profit_and_loss`, `balance_sheet`, `general_ledger` |
| 1.5d | Payroll → GL | `PayrollJournalService`, `referenceType: payroll_run`, payslip PDF |

### Phase 1.6 — Control plane

| ID | Deliverable | Key evidence |
|----|-------------|--------------|
| 1.6a | Audit trail | `AuditService` on sensitive modules; Settings → Audit log |
| 1.6a | Team admin | Email invite (`OrganizationInvite` + PropelAuth), join code, roles, remove member |
| 1.6b | Notifications | Bell UI; low stock, payroll, report ready, PO awaiting receipt; Resend email |
| 1.6c | PMS rates | `RatePlan` / `RateRule`, quote API, Rates tab, reservation auto-pricing |
| 1.6c+ | F&B bundles on rate plans | `inclusionPackageId`, `fbSupplementPerGuestPerNight` |

---

## Explicitly not shipped (Phase 1)

| Item | Notes |
|------|--------|
| `integrations` module | Health check only; OTAs in Phase 2 |
| Fiscal periods / period close | Deferred |
| Journal reversal | Deferred |
| Vendor payment (Dr AP / Cr Cash) | Receipt accrues AP only |
| `NotificationPreference` | Deferred |
| PDF financial reports | CSV via async jobs only |
| Distribution (OTA, offline POS, mobile, QR) | [phase2/README.md](./phase2/README.md) § Distribution |
| All Phase 1 deferrals (finance, integrations, branch access, …) | [phase2/README.md](./phase2/README.md) § Deferred from Phase 1 |

---

## Database migrations (production)

Apply all migrations before go-live:

```bash
cd apps/api && pnpm prisma migrate deploy
```

| Migration | Purpose |
|-----------|---------|
| `20260101000000_init` | Base schema |
| `20260531120000_employee_status` | Employee status |
| `20260531140000_guest_inclusions` | Inclusion packages |
| `20260531150000_phase_15_finance_procurement` | Vendors, POs, receipts |
| `20260601120000_notifications` | Notifications |
| `20260601180000_pms_rate_plans` | Rate plans and rules |
| `20260602100000_payroll_payslip` | Payslip storage key |
| `20260602120000_rate_plan_fb_bundle` | F&B bundle on rate plans |
| `20260603100000_organization_invite` | Email invite records |

Optional seed for local/demo: `pnpm db:seed`

---

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL |
| `REDIS_URL` | Yes | BullMQ (reports, payroll, notifications, PDF) |
| `PROPELAUTH_AUTH_URL`, `PROPELAUTH_API_KEY` | Yes | API auth |
| `PROPELAUTH_VERIFIER_KEY` | Web optional | Token verification |
| `NEXT_PUBLIC_*` | Web | API + auth URLs |
| MinIO vars | Yes | Payslips, report files |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional | Real notification email |
| `PROPELAUTH_ORG_MEMBER_ROLE` | Optional | Default `Member` for org email invites |

After changing `@erp/types` enums, rebuild: `pnpm --filter @erp/types build` (API `predev` runs this automatically).

---

## Test coverage (sign-off snapshot)

| Suite | Count | Notes |
|-------|-------|--------|
| API unit (`apps/api`) | 170 tests, 20 suites | `pnpm --filter @erp/api test` |
| E2E (`apps/web/e2e`) | 18 spec files | Mocked API; needs dev server on :3000 for live runs |

Representative E2E: `settings`, `procurement`, `rates`, `reports`, `audit`, `notifications`, `pms-flow`, `onboarding`.

---

## Production smoke checklist

Run on a staging stack with real PropelAuth and database:

1. **Auth & team** — Admin sends email invite → user signs up → `POST /auth/sync` → membership with assigned role.
2. **Join code (MVP)** — User requests join with code → admin approves with role.
3. **Procurement** — Create vendor → PO → submit → receive partial → stock up → journal in Accounting.
4. **Inventory / COGS** — Purchase with unit cost → average updates → complete POS order → COGS journal uses average.
5. **Payroll** — Run payroll → COMPLETED → GL journals + download payslip PDF from HR.
6. **Rates** — Seasonal plan + optional F&B bundle → new reservation quote → change dates → total recalculates.
7. **Reports** — Queue `profit_and_loss` and `trial_balance` CSV → job completes → download.
8. **Notifications** — Trigger low stock or complete report → bell + email (if Resend configured).

---

## Next steps

1. **Production soak** — 1–2 design-partner properties; monitor audit, payroll, and PO flows.
2. **Phase 2** — Prioritize per [phase2/README.md](./phase2/README.md) (channel manager after rates soak).
3. **SaaS launch** — Billing/plan limits: [saas-launch-guide.md](./saas-launch-guide.md).

---

## Related

- [Visual guide](./visual-guide.md) — module map, journeys, screenshots (`pnpm --filter @erp/web test:visual-guide`)
- [ERP completeness roadmap](./erp-completeness-roadmap.md) — full history and deferred items
- [PropelAuth](./propelauth.md) — auth and invite setup
- [Cloud deployment](./cloud-deployment.md) — production env layout

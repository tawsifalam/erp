---
name: Phase 1.6 Control Plane
overview: Audit trail, notifications, and PMS rate management after Phase 1.5 finance & supply chain.
todos:
  - id: audit-trail
    content: "1.6a AuditService, API GET /audit/logs, Settings tab, writes on tenants/procurement/accounting/PMS/inventory/HR/POS + E2E audit.spec.ts"
    status: completed
  - id: notifications
    content: "1.6b Notification model, in-app + email queue, header bell, hooks + E2E notifications.spec.ts"
    status: completed
  - id: pms-rates
    content: "1.6c RatePlan/RateRule, pricing quote API, Rates tab, reservation auto-pricing + E2E rates.spec.ts"
    status: completed
isProject: false
---

# Phase 1.6 — Platform & control plane

Build order per [erp-completeness-roadmap.md](../docs/erp-completeness-roadmap.md): **1.6a → 1.6b → 1.6c**.

## 1.6a Audit trail (done)

## 1.6b Notifications (done)

## 1.6c PMS rate management (done)

- `RatePlan` + `RateRule` models, migration `20260601180000_pms_rate_plans`
- `GET/POST/PATCH/DELETE /pms/rate-plans`, rules CRUD, `GET /pms/pricing/quote`
- Reservations store `ratePlanId`; create/update auto-price from plans
- PMS **Rates** tab; reservation drawer shows calculated total + hint
- E2E: `apps/web/e2e/rates.spec.ts` + `rates-state.ts` mocks

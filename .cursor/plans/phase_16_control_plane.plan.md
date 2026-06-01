---
name: Phase 1.6 Control Plane
overview: Audit trail, notifications, and PMS rate management after Phase 1.5 finance & supply chain.
todos:
  - id: audit-trail
    content: "1.6a AuditService, API GET /audit/logs, Settings tab, writes on tenants/procurement/accounting/PMS/inventory/HR/POS + E2E audit.spec.ts"
    status: completed
  - id: notifications
    content: "1.6b Notification model, email/in-app delivery, header bell UI"
    status: pending
  - id: pms-rates
    content: "1.6c RatePlan, RateRule, reservation pricing from plans"
    status: pending
isProject: false
---

# Phase 1.6 — Platform & control plane

Build order per [erp-completeness-roadmap.md](../docs/erp-completeness-roadmap.md): **1.6a → 1.6b → 1.6c**.

## 1.6a Audit trail (done)

- `AuditService.record()` + `GET /audit/logs` (ADMIN)
- Settings → **Audit log** tab with entity/date filters
- API writes: branches/org, team, procurement, journals, PMS lifecycle, inventory item/movement, HR employees, POS complete/cancel
- E2E: `apps/web/e2e/audit.spec.ts` + mutable `audit-state.ts` wired through route mocks

## 1.6b Notifications

- `Notification` entity, processor beyond log-only
- Low stock, payroll complete, report ready
- Header bell + mark read

## 1.6c PMS rate management

- `RatePlan`, `RateRule`, package bundles
- Reservation `totalAmount` from plan at booking time

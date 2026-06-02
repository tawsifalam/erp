# Phase 2 — Backlog

Phase 1 is complete ([phase1-signoff.md](../phase1-signoff.md)). Phase 2 covers **deferred Phase 1 items** (finance controls, integrations, platform polish) plus **distribution & scale** (OTA, mobile, offline POS).

**Related:** [erp-completeness-roadmap.md](../erp-completeness-roadmap.md) · [saas-launch-guide.md](../saas-launch-guide.md) (billing, launch)

---

## Deferred from Phase 1

Items intentionally left out of Phase 1 / 1.5 / 1.6. Grouped by theme; estimate when you pull each into a sprint.

### Finance & accounting

| Item | Phase 1 today | Phase 2 target |
|------|----------------|----------------|
| **Fiscal periods** | None; journals are not period-scoped | `FiscalPeriod` model, open/close, optional lock on new posts |
| **Period close** | N/A | Block or warn on POST to closed periods; admin reopen |
| **Journal reversal** | Manual offsetting entries only | Reversal API linked to original `JournalEntry` |
| **Vendor payment** | PO receive → Dr Inventory / Cr AP only | Payment run: Dr AP / Cr Cash; tie to vendor / PO |
| **PDF financial reports** | CSV via async `ReportJob` | PDF for trial balance, P&L, balance sheet, GL — [pdf-financial-reports.md](./pdf-financial-reports.md) |
| **GRNI / accrual PO** (optional) | Receipt posts to AP immediately | Accrue on receipt, reclass on invoice (if needed) |

**Docs:** [accounting-module.md](../accounting-module.md) (future section), [accounting-rules.md](../accounting-rules.md)

### Governance, notifications & audit

| Item | Phase 1 today | Phase 2 target |
|------|----------------|----------------|
| **`NotificationPreference`** | All events use fixed channels | Per-user toggles (email vs in-app) by event type — [notification-preferences.md](./notification-preferences.md) |
| **PO email to admins** | In-app `PO_AWAITING_RECEIPT` only | Optional email on PO submit (like payroll/low stock) |
| **Audit retention / export** | Query + filter in Settings | CSV export, retention policy (ops) |

### Integrations platform

| Item | Phase 1 today | Phase 2 target |
|------|----------------|----------------|
| **`integrations` module** | `GET /integrations/health` stub | Adapter registry, credentials, webhooks |
| **Channel manager / OTA** | Rates + availability in ERP only | See [channel-manager.md](./channel-manager.md) |
| **PMS event consumers** | `reservation.checked_in` etc. for Socket.IO | External webhooks for partners |

**Doc:** [channel-manager.md](./channel-manager.md) · [deployment.md](../deployment.md) (integrations stub note)

### Organization & access

| Item | Phase 1 today | Phase 2 target |
|------|----------------|----------------|
| **Branch-scoped membership** | Org-wide roles; any branch in header if org member | `UserBranch` grants per branch — [branch-invitations.md](./branch-invitations.md) |
| **Branch team UI** | Settings → org team only | Settings → **Branch access**; header hides unapproved branches |
| **`TenantGuard`** | `X-Organization-Id` + org role | Branch membership check on `X-Branch-Id` |

**Doc:** [organization-onboarding.md](../organization-onboarding.md) § Phase 2 — Branch invitations

### Reporting & analytics (enhancements)

| Item | Phase 1 today | Phase 2 target |
|------|----------------|----------------|
| **Cross-branch / org BI** | Per-branch exports + dashboard metrics | Rollups, comparisons — see [multi-property-analytics.md](./multi-property-analytics.md) |
| **Dashboard charts** | Tables + KPI cards | Trend charts, period-over-period |
| **Room revenue in dashboard** | Partial via reports | Dedicated PMS revenue widgets |

**Doc:** [reporting-module.md](../reporting-module.md) (update Phase 2 section when implemented)

---

## Distribution & scale (PRD index)

Competitive / reach features. Not required for the internal “complete ERP” bar; prioritize after Phase 1 soak.

| Feature | Doc | Est. | Depends on |
|---------|-----|------|------------|
| **Channel manager** | [channel-manager.md](./channel-manager.md) | 3 weeks | 1.6c rate plans, `integrations` |
| **Offline POS** | [offline-pos.md](./offline-pos.md) | 3–4 weeks | POS module |
| **Mobile app** | [mobile-app.md](./mobile-app.md) | 4 weeks | Auth, role-scoped APIs |
| **QR ordering** | [qr-ordering.md](./qr-ordering.md) | 2 weeks | POS menu, guest flow |
| **Multi-property analytics** | [multi-property-analytics.md](./multi-property-analytics.md) | 3 weeks | Reporting, branch data |

---

## SaaS & monetization (parallel track)

Not in `apps/` feature modules today; tracked in [saas-launch-guide.md](../saas-launch-guide.md):

- Stripe / Customer Portal, plan limits (`maxUsers`, branches)
- Self-serve signup provisioning
- Status page, GDPR export/delete (Enterprise tier)

Can run alongside Phase 2 engineering or after first design partners.

---

## Longer horizon (out of scope unless product direction changes)

From [erp-completeness-roadmap.md](../erp-completeness-roadmap.md) — large or vertical-specific; not default Phase 2:

| Area | Why deferred |
|------|----------------|
| Full tax / VAT engine | Jurisdiction-specific |
| Fixed assets & depreciation | Rare for hotel/restaurant MVP |
| Bank feed reconciliation | Bank API integrations |
| Manufacturing / MRP | Wrong vertical |
| CRM / marketing automation | Guest book sufficient for now |
| Multi-currency | First international property |

---

## In progress

| Sprint | Item | Doc | Status |
|--------|------|-----|--------|
| 1 | Fiscal periods & period close | [fiscal-periods.md](./fiscal-periods.md) | Shipped |
| 2 | Vendor payment | [vendor-payment.md](./vendor-payment.md) | Shipped |
| 3 | Journal reversal | [journal-reversal.md](./journal-reversal.md) | Shipped |
| 4 | PDF financial reports | [pdf-financial-reports.md](./pdf-financial-reports.md) | Shipped |
| 5 | Notification preferences | [notification-preferences.md](./notification-preferences.md) | Shipped |
| 6 | Branch invitations | [branch-invitations.md](./branch-invitations.md) | Shipped |

## Suggested build order

After **production soak** on Phase 1:

1. **Finance gaps** — fiscal periods + vendor payment (closes AP loop) — **done**
2. **Channel manager** — OTA sync (rates/availability already in ERP)
3. **`integrations` module** — credentials + adapter framework for OTAs
4. **Notification preferences** + PDF reports (quick UX wins)
5. **Branch invitations** — if multi-branch permissions become painful
6. **Offline POS / mobile / QR** — per property demand
7. **Multi-property analytics** — when groups need cross-branch BI

Adjust order for design-partner feedback.

---

## Module doc hygiene

Some module docs still say “Phase 2 (deferred)” for items **shipped in Phase 1.5/1.6** (e.g. payroll → GL, PDF payslip). When implementing a Phase 2 item, update the relevant module doc and remove stale deferred bullets.

---

## Related

- [Phase 1 sign-off](../phase1-signoff.md)
- [ERP completeness roadmap](../erp-completeness-roadmap.md)
- [Phase 2 channel manager](./channel-manager.md)

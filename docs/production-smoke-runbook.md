# Production smoke runbook

Use this checklist before go-live or after each major deploy. It validates **Phase 1** on a **real stack** (PropelAuth, PostgreSQL, Redis, MinIO, optional Resend) — not the mocked E2E suite.

**Authority:** [phase1-signoff.md](./phase1-signoff.md) · **Workflow detail:** [app-workflow-guide.md](./app-workflow-guide.md) · **Deploy:** [cloud-deployment.md](./cloud-deployment.md)

**Automated locally (subset):** [smoke-local.md](./smoke-local.md) — `pnpm smoke:local` with real PropelAuth + DB on localhost (no deploy required).

---

## Run metadata

| Field | Value |
|-------|--------|
| Environment | `staging` / `production` |
| Base URL (web) | |
| API URL | |
| Git commit / tag | |
| Tester | |
| Date | |
| PropelAuth project | |
| Resend configured? | Yes / No |

**Overall result:** ☐ Pass · ☐ Fail (blockers listed at bottom)

---

## Prerequisites

Complete before starting flows. All must pass.

| # | Check | Pass | Notes |
|---|--------|:----:|-------|
| P1 | `pnpm prisma migrate deploy` applied (all migrations in [phase1-signoff](./phase1-signoff.md#database-migrations-production)) | ☐ | |
| P2 | `GET {API}/health` returns OK | ☐ | |
| P3 | Web login redirects through PropelAuth and lands on `/dashboard` | ☐ | |
| P4 | Redis reachable (report/payroll jobs queue) | ☐ | |
| P5 | MinIO/S3 reachable (payslips, report files) | ☐ | |
| P6 | At least one org, branch, and ADMIN user exist (seed or onboarding) | ☐ | |
| P7 | Chart of accounts present (seed or manual) — codes **1000**, **1100**, **2000**, **4000**, **5100**, **2100** | ☐ | |
| P8 | Inventory pools exist for branch (guest / staff defaults or Settings) | ☐ | |

---

## 1. Auth & team (email invite)

**Goal:** PropelAuth invite → signup → ERP membership with assigned role.

| Step | Action | Pass | Evidence |
|------|--------|:----:|----------|
| 1.1 | As **ADMIN**, open **Settings → Team & access** | ☐ | |
| 1.2 | Send invite to a **new** email (not already in org) with role e.g. `FRONT_DESK` | ☐ | |
| 1.3 | Invitee receives PropelAuth email and completes signup | ☐ | |
| 1.4 | Invitee opens app → `POST /auth/sync` runs → lands on role home (e.g. `/pms` for front desk) | ☐ | |
| 1.5 | Admin sees member in team list with correct ERP role | ☐ | |
| 1.6 | **Settings → Audit log** shows invite/membership-related activity (if applicable) | ☐ | |

**Fail if:** invite stuck pending, wrong role, or user cannot access expected modules.

---

## 2. Join code (self-serve MVP)

**Goal:** Join request + admin approval path still works alongside email invite.

| Step | Action | Pass | Evidence |
|------|--------|:----:|----------|
| 2.1 | Admin copies **join code** from Settings → Team | ☐ | |
| 2.2 | Second test user (no org) uses onboarding **join with code** | ☐ | |
| 2.3 | Admin sees **pending join request** | ☐ | |
| 2.4 | Admin approves with role (e.g. `POS_STAFF`) | ☐ | |
| 2.5 | User can access POS (or role-scoped routes) after refresh | ☐ | |

---

## 3. Procurement (PO → receive → GL)

**Goal:** Purchasing increases stock and posts **Dr Inventory / Cr AP** (or equivalent seeded accounts).

| Step | Action | Pass | Evidence |
|------|--------|:----:|----------|
| 3.1 | **Procurement → Vendors** — create vendor | ☐ | |
| 3.2 | **Purchase orders** — new PO, add line (inventory SKU), **Create & submit** | ☐ | |
| 3.3 | Status **SUBMITTED**; admins get in-app **PO awaiting receipt** (bell) | ☐ | |
| 3.4 | **Receive** partial qty → stock increases on **Inventory** tab | ☐ | |
| 3.5 | **Accounting → Journal entries** — receipt journal with procurement reference | ☐ | |
| 3.6 | Receive remainder → PO **RECEIVED** / closed | ☐ | |

---

## 4. Inventory costing & COGS

**Goal:** Weighted-average updates on purchase; POS completion posts COGS at average.

| Step | Action | Pass | Evidence |
|------|--------|:----:|----------|
| 4.1 | Note item **average unit cost** before receive (or after 3.4) | ☐ | Before: ___ After: ___ |
| 4.2 | Receive or record **PURCHASE** movement with **unit price** | ☐ | |
| 4.3 | Average cost changed as expected | ☐ | |
| 4.4 | **POS** — complete a menu item with BOM (Send to kitchen → Complete & pay) | ☐ | |
| 4.5 | **Accounting** — COGS journal uses non-placeholder amounts (average × qty) | ☐ | |

---

## 5. Payroll & payslip

**Goal:** Payroll run completes, posts GL, payslip PDF downloadable.

| Step | Action | Pass | Evidence |
|------|--------|:----:|----------|
| 5.1 | **HR** — at least one active employee with salary | ☐ | |
| 5.2 | **Payroll** tab → **Run payroll for current month** → confirm | ☐ | |
| 5.3 | Run reaches **COMPLETED** (refresh if queued) | ☐ | Run ID: ___ |
| 5.4 | **Accounting** — journal(s) with `referenceType: payroll_run` | ☐ | |
| 5.5 | Download **payslip PDF** from HR payroll row | ☐ | File opens |

---

## 6. PMS rates & reservation pricing

**Goal:** Rate plan + optional F&B bundle drives quote; date change recalculates.

| Step | Action | Pass | Evidence |
|------|--------|:----:|----------|
| 6.1 | **PMS → Room types** then **Rooms** exist (setup order in [visual-guide](./visual-guide.md)) | ☐ | |
| 6.2 | **Rates** — plan with room type, date range, optional **guest package** + F&B supplement | ☐ | |
| 6.3 | **Reservations → New** — guest, dates, room → **pricing quote** and total shown | ☐ | Total: ___ |
| 6.4 | Change dates → total **recalculates** | ☐ | New total: ___ |
| 6.5 | (Optional) **Rules** on plan — weekend/min-stay override reflected in quote | ☐ | |

---

## 7. Financial reports (CSV)

**Goal:** Async export jobs complete; files download from Reports or notification link.

| Step | Action | Pass | Evidence |
|------|--------|:----:|----------|
| 7.1 | **Reports** — queue **Profit & loss** with date range | ☐ | |
| 7.2 | Job **COMPLETED**; CSV downloads and opens | ☐ | |
| 7.3 | Queue **Trial balance** for same period | ☐ | |
| 7.4 | Trial balance debits = credits (or within rounding) | ☐ | |
| 7.5 | (Optional) **General ledger** for one account code | ☐ | |

---

## 8. Notifications

**Goal:** In-app bell; email when Resend configured.

| Step | Action | Pass | Evidence |
|------|--------|:----:|----------|
| 8.1 | Trigger **report ready** (from §7) → bell shows link | ☐ | |
| 8.2 | Trigger **low stock** (adjust item below threshold or use dashboard signal) | ☐ | |
| 8.3 | If `RESEND_API_KEY` set — HR/admin receives **email** for payroll complete or low stock | ☐ | N/A if no Resend |
| 8.4 | Mark notification read; count updates | ☐ | |

---

## Optional deep checks

Not required for Phase 1 sign-off; run if time allows.

| Area | Check | Pass |
|------|--------|:----:|
| PMS lifecycle | Inquiry → Confirm → Check-in → Check-out → room **DIRTY** → **VACANT** | ☐ |
| Guest inclusions | Checked-in reservation → **Inclusions** → record comp meal | ☐ |
| Audit | Settings → **Audit log** filters by entity after procurement/payroll | ☐ |
| RBAC | `FRONT_DESK` cannot open `/settings` or `/accounting` | ☐ |
| Realtime | Kitchen display updates when order sent (Socket.IO) | ☐ |

---

## Blockers & follow-ups

| ID | Severity | Description | Owner |
|----|----------|-------------|-------|
| B1 | | | |
| B2 | | | |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering | | | |
| Product / ops | | | |

When all **prerequisites** and **sections 1–8** pass:

1. Record result in run metadata above.
2. Begin **production soak** (1–2 design-partner properties).
3. Prioritize **Phase 2** per [phase2/README.md](./phase2/README.md) (suggested: fiscal periods + vendor payment, then channel manager).

---

## Related

- [Phase 1 sign-off](./phase1-signoff.md)
- [SaaS launch checklist](./saas-launch-guide.md) (billing, legal, monitoring — parallel track)
- [Visual guide](./visual-guide.md) — training PDF (`pnpm visual-guide`, local only)

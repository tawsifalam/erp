# Phase 2 — Fiscal periods & period close

**Status:** Shipped (Sprint 1 — May 2026)  
**Deferred from:** Phase 1 ([README](./README.md) § Finance & accounting)

## Goal

Org-scoped **fiscal periods** with **open/close** control. Manual and auto-posted journals must land in an **open** period for the entry date.

## Data model

| Field | Purpose |
|-------|---------|
| `FiscalPeriod` | `name`, `startDate`, `endDate`, `status` (`OPEN` \| `CLOSED`), `closedAt`, `closedByUserId` |
| `JournalEntry.entryDate` | Posting date (defaults to now) |
| `JournalEntry.fiscalPeriodId` | Resolved period at post time |

## API (`/accounting/fiscal-periods`)

| Method | Path | Permission | Action |
|--------|------|------------|--------|
| GET | `/accounting/fiscal-periods` | `ACCOUNTING_READ` | List periods |
| POST | `/accounting/fiscal-periods` | `ACCOUNTING_WRITE` | Create (no overlap) |
| PATCH | `.../:id/close` | `ACCOUNTING_WRITE` | Close period |
| PATCH | `.../:id/reopen` | `ACCOUNTING_WRITE` | Reopen (admin workflow) |

`POST /accounting/journals` accepts optional `entryDate` (ISO). Rejects when period is closed or missing.

## UI

**Accounting → Fiscal periods** tab: list, create period, close/reopen.

## Acceptance criteria

- [x] Create non-overlapping periods for an org
- [x] Post journal succeeds when period is OPEN
- [x] Post journal fails with clear error when period is CLOSED
- [x] Auto-posting (PMS, POS, payroll, procurement) uses current date and respects open period
- [x] Seed includes a demo OPEN period (`FY 2026`)
- [x] API unit tests + E2E mock updated

## Next (Sprint 2)

**Vendor payment** — Dr AP / Cr Cash, tied to vendor/PO ([README](./README.md)).

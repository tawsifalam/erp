# Phase 2 — Journal reversal

**Status:** Shipped (Sprint 3 — May 2026)  
**Deferred from:** Phase 1 ([README](./README.md) § Finance & accounting)

## Goal

Post an **offsetting journal entry** linked to an original entry instead of manual mirror postings.

| Original | Reversal |
|----------|----------|
| Dr Utilities 500 / Cr Bank 500 | Dr Bank 500 / Cr Utilities 500 |

## Data model

On `JournalEntry`:

| Field | Set on |
|-------|--------|
| `reversesEntryId` | Reversal row (FK → original, unique) |
| `reversedAt` | Original row when reversed |

Constraints:

- Cannot reverse a **reversal** entry
- Cannot reverse an entry **already reversed**
- Reversal posts in an **open fiscal period** (same rules as new journals)

## API

| Method | Path | Permission |
|--------|------|------------|
| POST | `/accounting/journals/:id/reverse` | `ACCOUNTING_WRITE` |

**Optional body:** `{ "entryDate": "2026-05-31" }` (defaults to today).

**Response:** New reversal entry (includes `reversesEntry` link).

**Journal metadata:** `referenceType: journal_reversal`, `referenceId: <original id>`.

## UI

**Accounting → Journal entries** — each entry shows:

- **Reverse** button (if not reversed and not itself a reversal)
- **Reversed** badge on originals
- **Reversal** badge on offsetting entries

Confirm dialog before posting.

## Audit

- `REVERSE` on original entry (`metadata.reversalEntryId`)
- `CREATE` on reversal entry

## Tests

| Suite | Coverage |
|-------|----------|
| API unit | `accounting.service.spec.ts` — `reverseJournalEntry` |
| E2E (mock) | `accounting.spec.ts` — post → reverse → badges |
| Smoke (real) | `smoke-local-06` — post → reverse |

## Migration

`20260612100000_journal_reversal`

## Next (Sprint 6)

**Branch invitations** — per-branch membership ([README](./README.md)).

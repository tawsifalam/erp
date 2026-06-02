# Phase 2 — PDF financial reports

**Status:** Shipped (Sprint 4 — May 2026)  
**Deferred from:** Phase 1 ([README](./README.md) § Finance & accounting)

## Goal

Add **PDF export** for organization-wide financial reports alongside existing CSV exports.

| Report | PDF | CSV |
|--------|-----|-----|
| Trial balance | ✓ | ✓ |
| Profit & loss | ✓ | ✓ |
| Balance sheet | ✓ | ✓ |
| General ledger | ✓ | ✓ |

Branch-scoped operational reports (`branch_summary`, `low_stock`, `revenue_today`) remain **CSV only**.

## API

`POST /reporting/export` accepts optional `format`:

```json
{
  "type": "trial_balance",
  "asOf": "2026-05-31",
  "format": "pdf"
}
```

| `format` | Default | Notes |
|----------|---------|-------|
| `csv` | yes | All report types |
| `pdf` | — | Financial types only; `400` for branch reports |

`format` is stored on `ReportJob.params` and used by `ReportsProcessor` when generating the file.

`GET /reporting/types` includes `supportsPdf: true` for financial report codes.

## Generation

- **CSV:** unchanged — `FinancialReportGeneratorsService.generate()`
- **PDF:** `FinancialReportGeneratorsService.generatePdf()` → `buildFinancialReportPdf()` (`@erp/utils` `buildMinimalPdf` under the hood)
- Uploaded as `reports/{jobId}.pdf` with `Content-Type: application/pdf`

Trial balance PDF includes a **TOTAL** row (debits = credits when books balance).

## UI

**Reports** page (`/reports`):

- **Export CSV** — all report types
- **Export PDF** — shown when selected type has `supportsPdf`

Jobs table download link points to `.pdf` or `.csv` depending on job.

## Tests

| Suite | Coverage |
|-------|----------|
| API unit | `financial-report-pdf.spec.ts`, `financial-report-generators.service.spec.ts`, `reports.processor.spec.ts` (PDF upload), `reporting.service.spec.ts` (format validation) |
| E2E (mock) | `reports.spec.ts` — P&L PDF export + download link |
| Smoke (real) | `smoke-local-06` — trial balance PDF queue |

## Next (Sprint 6)

**Branch invitations** — per-branch membership ([README](./README.md)).

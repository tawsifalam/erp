# Reporting module reference

Branch-scoped **dashboard metrics** and async **CSV exports** via BullMQ.

## Scope and tenancy

| Feature | Scoped by | Notes |
|---------|-----------|-------|
| Dashboard | Branch | Requires `branchId` (header or query) |
| Report exports | Branch | All phase 1 report types are branch-scoped |
| Report jobs list | Organization | Last 20 jobs per org |

All routes require `Authorization`, `X-Organization-Id`, and `REPORTS_READ` (OWNER, ADMIN, ACCOUNTANT, HR).

IDs use prefix `rpt_`.

## Dashboard metrics

`GET /reporting/dashboard?branchId=$BRANCH_ID`

| Metric | Calculation |
|--------|-------------|
| `occupancyPct` | Rooms with status `OCCUPIED` ÷ total rooms × 100 |
| `activeReservations` | Count of `INQUIRY`, `CONFIRMED`, `CHECKED_IN` reservations |
| `revenueToday` | Sum of `totalAmount` for `COMPLETED` POS orders created today |
| `lowStockAlerts` | Items where `currentStock <= lowStockThreshold` (all pools) |
| `lowStockItems` | Array of low-stock item details |

Web UI: `/dashboard` (stat cards + low-stock list).

## Report types (CSV exports)

| Code | Label | CSV contents |
|------|-------|--------------|
| `branch_summary` | Branch summary | Dashboard metrics as key/value rows |
| `low_stock` | Low stock items | SKU, name, pool, stock vs threshold |
| `revenue_today` | Today's revenue (POS) | Completed orders today |

Legacy alias: `summary` → `branch_summary`.

List types: `GET /reporting/types`

## Export flow

```
POST /reporting/export { type, branchId? }
  → Create ReportJob (PENDING)
  → BullMQ "reports" queue
  → ReportsProcessor
      → PROCESSING
      → Generate CSV (ReportGeneratorsService)
      → Upload to storage
      → COMPLETED (fileUrl) or FAILED (errorMessage)
```

List jobs: `GET /reporting/jobs`

## API reference

```bash
curl -s "$BASE/reporting/dashboard?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq

curl -s "$BASE/reporting/types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/reporting/export" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{"type":"branch_summary","branchId":"'$BRANCH_ID'"}' | jq

curl -s "$BASE/reporting/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

## Web UI

| Page | Features |
|------|----------|
| `/dashboard` | Occupancy, reservations, revenue, low-stock alerts + item list |
| `/reports` | Report type picker, export CSV, jobs table with download link and poll while pending |

## Job statuses

`PENDING` → `PROCESSING` → `COMPLETED` | `FAILED`

## Phase 2 (deferred)

- PDF reports, GL/trial balance exports
- Cross-branch / org analytics
- Charts and period comparisons
- PMS room revenue in dashboard

## Testing

```bash
pnpm --filter @erp/api test -- reporting
pnpm --filter @erp/web test:e2e reports
pnpm --filter @erp/web test:e2e dashboard
```

E2E mocks: `apps/web/e2e/helpers/reporting-state.ts`

See also [app-workflow-guide.md §7](./app-workflow-guide.md#7-reporting--dashboard).

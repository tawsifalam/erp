# Accounting module reference

Organization-scoped **double-entry bookkeeping**: chart of accounts, manual journals, and automated postings from PMS and POS.

## Scope and tenancy

| Entity | Scoped by | Notes |
|--------|-----------|-------|
| Accounts | Organization | Unique `code` per org |
| Journal entries | Organization | Immutable after post (no edit/delete in phase 1) |

All accounting routes require `Authorization` and `X-Organization-Id`. Branch header is not required — accounting is consolidated at org level.

IDs use prefixes from seed/runtime: `acc_`, `je_`, `jl_`.

## Web UI (`/accounting`)

Select **organization** in the header (branch optional).

| Tab | Features |
|-----|----------|
| **Journal entries** | List recent entries with debit/credit lines per account |
| **Chart of accounts** | List accounts; **add** account (code, name, type) |
| **Post journal** | Opens **FormDrawer** with multi-line entry, running debit/credit totals, and balance indicator; posts when debits = credits |

Links from **POS → Orders** (“View journals →”) open this page.

## Double-entry rule

```
total debits === total credits   (always)
At least 2 lines per entry
```

Unbalanced entries return `400 Bad Request`.

## Automated postings

Operations succeed even if accounts are missing; journals are **skipped** when required account codes are not in the chart.

### POS — `order.completed`

| Payment | Journal |
|---------|---------|
| **Full pay** (`paidAmount >= total`) | Cash (1000) Dr total / F&B Revenue (4100) Cr total |
| **Partial pay** | Cash Dr `paidAmount` + AR (1300) Dr balance / F&B Revenue Cr `totalAmount` |
| **Unpaid complete** | AR Dr total / F&B Revenue Cr total |

**COGS** (when recipes exist): COGS (5000) Dr / Inventory (1200) Cr estimated amount.

Inventory deduction runs regardless of payment status.

### PMS — reservation folio

| Event | Journal |
|-------|---------|
| `reservation.payment_recorded` (delta > 0) | Cash Dr / Room Revenue (4000) Cr |
| `reservation.checked_out` (unpaid balance) | AR (1300) Dr / Room Revenue Cr |

See [pms-module.md](./pms-module.md) for folio payment flow.

## Seeded chart of accounts (demo)

| Code | Name | Type |
|------|------|------|
| 1000 | Cash | ASSET |
| 1100 | Bank Account | ASSET |
| 1200 | Inventory | ASSET |
| 1300 | Accounts Receivable | ASSET |
| 2000 | Accounts Payable | LIABILITY |
| 2100 | Salary Payable | LIABILITY |
| 3000 | Owner Equity | EQUITY |
| 4000 | Room Revenue | REVENUE |
| 4100 | F&B Revenue | REVENUE |
| 4200 | Other Revenue | REVENUE |
| 5000 | Cost of Goods Sold | EXPENSE |
| 5100 | Salary Expense | EXPENSE |
| 5200 | Utilities Expense | EXPENSE |
| 5300 | Maintenance Expense | EXPENSE |

## API reference

Base: `$BASE` = `http://localhost:3001/api`

### Accounts

```bash
curl -s "$BASE/accounting/accounts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/accounting/accounts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"code":"5400","name":"Marketing Expense","type":"EXPENSE"}' | jq
```

Account `type` must be: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, or `EXPENSE`.

### Journals

```bash
curl -s "$BASE/accounting/journals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/accounting/journals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Monthly electricity bill",
    "lines": [
      { "accountId": "<utilities-acc-id>", "debit": 12000, "credit": 0 },
      { "accountId": "<bank-acc-id>", "debit": 0, "credit": 12000 }
    ]
  }' | jq
```

## Events → journals

| Event | Listener | Method |
|-------|----------|--------|
| `order.completed` | `OrderEventsListener` | `postFoodSale`, `postCogs` |
| `reservation.payment_recorded` | `PmsEventsListener` | `postRoomPayment` |
| `reservation.checked_out` | `PmsEventsListener` | `postRoomReceivable` |

## Permissions

| Role | Access |
|------|--------|
| OWNER, ADMIN | All accounting permissions |
| ACCOUNTANT | `ACCOUNTING_READ`, `ACCOUNTING_WRITE` |
| Others | No accounting write by default (see `packages/utils/src/rbac.ts`) |

## Testing

```bash
pnpm --filter @erp/api test -- accounting
pnpm --filter @erp/api test -- accounting-listeners
pnpm --filter @erp/api test -- order-events.listener
pnpm --filter @erp/api test -- pms-events.listener
pnpm --filter @erp/web test:e2e accounting
```

E2E coverage includes journal list, chart of accounts, add account, post balanced journal, and unbalanced validation (`e2e/accounting.spec.ts`).

## Related docs

- [Accounting rules](./accounting-rules.md) — double-entry summary
- [App workflow guide §5](./app-workflow-guide.md#5-accounting) — step-by-step examples

## Fiscal periods (Phase 2)

Org-scoped periods with **open/close**. All journal posts (manual and auto) require an **open** period covering `entryDate`.

- **API:** `GET/POST /accounting/fiscal-periods`, `PATCH .../:id/close`, `PATCH .../:id/reopen`
- **UI:** Accounting → **Fiscal periods** tab
- **Doc:** [phase2/fiscal-periods.md](./phase2/fiscal-periods.md)

## Journal reversal (Phase 2)

- **API:** `POST /accounting/journals/:id/reverse`
- **UI:** Reverse button on journal cards; Reversed / Reversal badges
- **Doc:** [phase2/journal-reversal.md](./phase2/journal-reversal.md)

## Vendor payment (Phase 2)

See [phase2/vendor-payment.md](./phase2/vendor-payment.md) — Dr AP / Cr Cash or Bank from Procurement.

## Future (Phase 2)

- PDF financial reports

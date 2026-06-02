# Phase 2 — Vendor payment

**Status:** Shipped (Sprint 2 — May 2026)  
**Deferred from:** Phase 1 ([README](./README.md) § Finance & accounting)

## Goal

Close the **accounts payable** loop after goods receipt:

| Step | GL (seeded accounts) |
|------|----------------------|
| Receive goods | Dr **1200** Inventory / Cr **2000** AP |
| **Vendor payment** | Dr **2000** AP / Cr **1000** Cash or **1100** Bank |

## Data model

`VendorPayment`: org, branch, vendor, optional `purchaseOrderId`, `amount`, `paymentDate`, `payFromAccountCode` (`1000` \| `1100`), optional `reference`.

Journal: `referenceType: vendor_payment`, `referenceId: <payment id>`.

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/procurement/vendor-payments` | `INVENTORY_READ` |
| GET | `/procurement/vendors/:id/ap-balance` | `INVENTORY_READ` |
| POST | `/procurement/vendor-payments` | `ACCOUNTING_WRITE` |

**POST body**

```json
{
  "vendorId": "…",
  "amount": 495,
  "paymentDate": "2026-05-31",
  "payFromAccountCode": "1100",
  "purchaseOrderId": "…",
  "reference": "CHK-1001"
}
```

**Validation**

- Amount &gt; 0
- Payment ≤ **outstanding AP** for vendor on branch (`accrued received value − prior payments`)
- Optional PO must match vendor + branch
- Posting respects **open fiscal period** for `paymentDate`

## UI

**Procurement → Vendor payments** tab: list payments, **+ Record payment** drawer with AP balance hint.

## Tests

| Suite | Coverage |
|-------|----------|
| API unit | `procurement.service.spec.ts` — balance guard, GL hook |
| API unit | `accounting-listeners.service.spec.ts` — `postVendorPayment` |
| E2E (mock) | `procurement.spec.ts` — receive → pay → journal visible |
| Smoke (real) | `smoke-local-03` — record payment after PO receive |

## Migration

`20260611100000_vendor_payments`

## Next (Sprint 3)

**Journal reversal** — linked offset to original `JournalEntry` ([README](./README.md)).

# Accounting rules

## Double entry

Every journal entry must balance:

```
totalDebit === totalCredit
```

At least two lines are required. Unbalanced entries are rejected with `400 Bad Request`.

## Seeded accounts (demo org)

See full chart in [accounting-module.md](./accounting-module.md). Key codes used by automation:

| Code | Name | Type |
|------|------|------|
| 1000 | Cash | ASSET |
| 1200 | Inventory | ASSET |
| 1300 | Accounts Receivable | ASSET |
| 4000 | Room Revenue | REVENUE |
| 4100 | F&B Revenue | REVENUE |
| 5000 | COGS | EXPENSE |

## Automated postings

If required accounts are missing, the business operation still succeeds; the journal is skipped.

### F&B sale (order completed)

**Full payment:**
```
Cash (1000)           Dr  paidAmount (= total)
F&B Revenue (4100)        Cr  totalAmount
```

**Partial payment:**
```
Cash (1000)           Dr  paidAmount
AR (1300)             Dr  totalAmount − paidAmount
F&B Revenue (4100)        Cr  totalAmount
```

**Unpaid (complete with paidAmount = 0):**
```
AR (1300)             Dr  totalAmount
F&B Revenue (4100)        Cr  totalAmount
```

### Inventory consumption (when recipes exist)

```
COGS (5000)           Dr  estimated COGS
Inventory (1200)          Cr  estimated COGS
```

### Room payment (PMS payment delta)

```
Cash (1000)           Dr  deltaPaid
Room Revenue (4000)       Cr  deltaPaid
```

### Room receivable (check-out balance)

```
AR (1300)             Dr  unpaidAmount
Room Revenue (4000)       Cr  unpaidAmount
```

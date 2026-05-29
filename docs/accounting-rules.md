# Accounting rules

## Double entry

Every journal entry must balance:

```
totalDebit === totalCredit
```

At least two lines are required. Unbalanced entries are rejected with `400 Bad Request`.

## Seeded accounts (demo org)

| Code | Name | Type |
|------|------|------|
| 1000 | Cash | ASSET |
| 1200 | Inventory | ASSET |
| 4000 | Room Revenue | REVENUE |
| 4100 | F&B Revenue | REVENUE |
| 5000 | COGS | EXPENSE |

## Automated postings

**F&B sale (order completed):**

```
Cash     Dr  amount
F&B Rev      Cr  amount
```

**Inventory consumption:**

```
COGS         Dr  amount
Inventory        Cr  amount
```

# Inventory ledger

Stock is **never** stored as a source-of-truth column.

## Formula

```
Current stock = SUM(IN movements) − SUM(OUT movements)
```

## Movement types

| Type | Direction |
|------|-----------|
| PURCHASE | IN |
| SALE | OUT |
| WASTE | OUT |
| STAFF_MEAL | OUT |
| ADJUSTMENT | IN or OUT (by quantity sign in service) |

## Order flow

1. POS completes order → `order.completed` event
2. Recipe lines loaded per menu item
3. OUT movements created (`referenceType: Order`)
4. Accounting posts COGS (optional amount from recipe cost)

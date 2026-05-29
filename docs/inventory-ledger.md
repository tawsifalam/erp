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
| ADJUSTMENT | IN or OUT — set `"direction": "IN"` or `"OUT"` in the movement API body (quantity is always positive) |

## Order flow

1. POS completes order → `order.completed` event
2. Recipe lines loaded per menu item
3. OUT movements created (`referenceType: Order`, `movementType: SALE`)
4. Accounting posts COGS (estimated amount from recipe qty × placeholder unit cost)

See [inventory-module.md](./inventory-module.md) for full API and UI reference.

# Inventory module reference

Branch-scoped stock ledger, manual movements, recipe/BOM auto-deduction on POS order completion, and low-stock alerts.

## Scope and tenancy

| Entity            | Scoped by | Notes |
|-------------------|-----------|-------|
| Inventory items   | Branch    | SKU unique per branch |
| Movements         | Branch    | Ledger entries (IN/OUT) |
| Recipes (BOM)     | Menu item | Links menu item → inventory lines |

All inventory routes require `Authorization`, `X-Organization-Id`, and usually `X-Branch-Id` (or `branchId` query param).

Stock is **never** stored as a column — `currentStock` is computed as `SUM(IN) − SUM(OUT)`.

IDs use prefixes from seed/runtime: `inv_`, `mov_`, `rl_`.

## Web UI (`/inventory`)

Select **organization** and **branch** in the header first.

| Tab | Features |
|-----|----------|
| **Items & movements** | List items with on-hand stock and **LOW/OK** status; **create** item; **edit** name, unit, low-stock threshold (click row); **record movement** (purchase, waste, staff meal, sale, adjustment IN/OUT); view movement history |
| **Recipes (BOM)** | Select menu item; edit ingredient lines; save recipe — POS order completion deducts automatically |

## Ledger formula

```
Current stock = SUM(IN movements) − SUM(OUT movements)
```

## Movement types

| Type | Direction | When used |
|------|-----------|-----------|
| `PURCHASE` | IN | Goods received from supplier |
| `ADJUSTMENT` | IN or OUT | Stock correction — pass `"direction": "IN"` or `"OUT"` in API body |
| `SALE` | OUT | POS order completed (recipe auto-deduction) or manual sale |
| `WASTE` | OUT | Spoilage / damage |
| `STAFF_MEAL` | OUT | HR staff meal recording |

## Low stock

Set `lowStockThreshold` on an item. When `currentStock <= threshold`, the UI shows **LOW** (red).

## Recipe auto-deduction

On `order.completed`:

```
OrderEventsListener → InventoryRecipesService.deductForOrder()
  → For each order line with a recipe:
    → SALE movement OUT, qty = recipeLine.qty × orderLine.qty
  → Returns estimated COGS (phase 1: qty × 1 placeholder)
```

Configure recipes in **Inventory → Recipes (BOM)** or via API below.

## API reference

Base: `$BASE` = `http://localhost:3001/api`

### Items

```bash
curl -s "$BASE/inventory/items?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/inventory/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"branchId":"'$BRANCH_ID'","name":"Basmati Rice","sku":"RICE-01","unit":"kg","lowStockThreshold":10}' | jq

curl -s -X PATCH "$BASE/inventory/items/$ITEM_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Premium Rice","lowStockThreshold":5}' | jq

curl -s "$BASE/inventory/items/$ITEM_ID/stock?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

### Movements

```bash
curl -s -X POST "$BASE/inventory/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"itemId":"'$ITEM_ID'","branchId":"'$BRANCH_ID'","movementType":"PURCHASE","quantity":25}' | jq

curl -s -X POST "$BASE/inventory/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"itemId":"'$ITEM_ID'","branchId":"'$BRANCH_ID'","movementType":"WASTE","quantity":2}' | jq

curl -s -X POST "$BASE/inventory/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"itemId":"'$ITEM_ID'","branchId":"'$BRANCH_ID'","movementType":"ADJUSTMENT","direction":"OUT","quantity":1.5}' | jq

curl -s "$BASE/inventory/items/$ITEM_ID/movements?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

### Recipes (BOM)

```bash
curl -s -X POST "$BASE/inventory/recipes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"menuItemId":"'$MENU_ITEM_ID'","lines":[{"inventoryItemId":"'$ITEM_ID'","quantity":0.3}]}' | jq

curl -s "$BASE/inventory/recipes/$MENU_ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

## HR integration

`POST /hr/staff-meals` records a staff meal and creates a `STAFF_MEAL` OUT movement for the selected inventory item.

## Accounting integration

When POS orders complete with recipes, `order.completed` triggers COGS journal (Debit COGS / Credit Inventory) using the estimated COGS from recipe deduction. See [pos-module.md](./pos-module.md) and [accounting-rules.md](./accounting-rules.md).

## Permissions

| Role | Access |
|------|--------|
| OWNER, ADMIN | All inventory permissions |
| ACCOUNTANT | `INVENTORY_READ` |
| Others | No inventory write by default (see `packages/utils/src/rbac.ts`) |

## Testing

```bash
pnpm --filter @erp/api test -- inventory
pnpm --filter @erp/api test -- inventory-recipes
pnpm --filter @erp/api test -- order-events.listener
pnpm --filter @erp/web test:e2e inventory
```

E2E coverage includes item list, create item, record movement, edit/low-stock, and recipe save (`e2e/inventory.spec.ts`).

## Related docs

- [Inventory ledger](./inventory-ledger.md) — movement model summary
- [App workflow guide §4](./app-workflow-guide.md#4-inventory-management) — step-by-step examples

## Future (phase 2)

- Real unit costing for COGS (replace qty × 1 placeholder)
- Purchase orders / supplier management
- Multi-location transfers between branches

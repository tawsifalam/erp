# POS module reference

Point of Sale: branch menu, cashier orders, kitchen display, payment, and integration with inventory and accounting.

## Scope and tenancy

| Entity        | Scoped by | Notes |
|---------------|-----------|-------|
| Menu categories | Branch | Sort order for display |
| Menu items    | Category (branch via category) | Price per item |
| Orders        | Branch | Lines reference menu items |
| Kitchen tickets | Order | Created on submit |

All POS routes require `Authorization`, `X-Organization-Id`, and usually `X-Branch-Id` (or `branchId` query param).

IDs use prefixes from seed/runtime: `mc_`, `mi_`, `ord_`, `ol_`, `kt_`.

## Web UI

### `/pos` (Cashier)

Select **organization** and **branch** in the header first.

| Tab | Features |
|-----|----------|
| **Orders** | List orders; **new order** cart; optional **Charge to room** (checked-in reservation); table #, notes; Send to Kitchen; Complete & Pay; Cancel; Delete |
| **Menu** | Categories and items; **Guest inclusion meal** flag for comp board items linked to stay allowances |

### `/pos/kitchen` (Kitchen display)

Full-screen kitchen queue (also linked from **POS → Kitchen display** and the sidebar **Kitchen** nav).

| Feature | Detail |
|---------|--------|
| **Branch** | Uses the selected branch from the header tenant selector (same as POS). Change org/branch on this page without returning to POS. |
| **Queue** | SUBMITTED / PREPARING / READY orders only; oldest first (FIFO). COMPLETED and CANCELLED orders drop off automatically. |
| **Actions** | **Start prep** (SUBMITTED → PREPARING), **Mark ready** (PREPARING → READY) |
| **Realtime** | Refreshes on `kitchen.ticket` and `order.updated` via Socket.IO; manual **Refresh queue** button |
| **Payment** | Complete & pay on **POS** (`/pos`) when ready — kitchen does not take payment |
| **Cancel** | Cashier cancels SUBMITTED orders on POS; kitchen queue updates via `order.updated` |

## Order lifecycle

```
DRAFT ──submit──► SUBMITTED ──kitchen──► PREPARING ──► READY ──complete──► COMPLETED
  │                    │
  └──── cancel ────────┴──── cancel ───► CANCELLED
```

- **DRAFT**: Created at cashier; not visible in kitchen queue until submitted.
- **SUBMITTED**: Kitchen ticket created; blocks cancel after prep starts (PREPARING/READY).
- **PREPARING / READY**: Kitchen status updates only via allowed transitions.
- **COMPLETED**: Payment recorded; emits `order.completed` (inventory + accounting).
- **CANCELLED**: Only from DRAFT or SUBMITTED.

## Payment status

Set on complete via `paidAmount`:

| Condition | paymentStatus |
|-----------|---------------|
| `paidAmount >= totalAmount` | PAID |
| `0 < paidAmount < total` | PARTIAL |
| `paidAmount === 0` | UNPAID |

## Delete rules

| Entity | Allowed when |
|--------|----------------|
| Menu category | No menu items in category |
| Menu item | Never referenced on an order line |
| Order | `DRAFT` or `CANCELLED` only (completed orders kept for audit) |

## API reference

Base: `$BASE` = `http://localhost:3001/api`

### Menu

```bash
curl -s "$BASE/pos/menu/categories?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/pos/menu/categories" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d "{\"branchId\":\"$BRANCH_ID\",\"name\":\"Mains\",\"sortOrder\":1}" | jq

curl -s -X PATCH "$BASE/pos/menu/categories/$CAT_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Main Courses"}' | jq

curl -s -X DELETE "$BASE/pos/menu/categories/$CAT_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/pos/menu/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d "{\"categoryId\":\"$CAT_ID\",\"name\":\"Chicken Biryani\",\"price\":320}" | jq

curl -s -X PATCH "$BASE/pos/menu/items/$ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"price":350}' | jq

curl -s -X DELETE "$BASE/pos/menu/items/$ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

### Orders

```bash
curl -s "$BASE/pos/orders?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/pos/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d "{\"branchId\":\"$BRANCH_ID\",\"tableNumber\":\"T7\",\"notes\":\"No nuts\",\"lines\":[{\"menuItemId\":\"$ITEM_ID\",\"quantity\":2,\"unitPrice\":320}]}" | jq

curl -s -X POST "$BASE/pos/orders/$ORDER_ID/submit?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X PATCH "$BASE/pos/orders/$ORDER_ID/status?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"PREPARING"}' | jq

curl -s -X PATCH "$BASE/pos/orders/$ORDER_ID/status?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"READY"}' | jq

curl -s -X POST "$BASE/pos/orders/$ORDER_ID/complete?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"paidAmount":640}' | jq

curl -s -X POST "$BASE/pos/orders/$ORDER_ID/cancel?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X DELETE "$BASE/pos/orders/$ORDER_ID?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

## Realtime

Kitchen clients join `kitchen:<branchId>`:

```typescript
socket.emit("join", `kitchen:${branchId}`);
socket.on("kitchen.ticket", () => { /* new ticket */ });
socket.on("order.updated", () => { /* refresh queue */ });
```

## Inventory and accounting (on complete)

When an order is **completed**, `order.completed` triggers:

1. **Recipe deduction** — `InventoryRecipesService.deductForOrder` posts SALE movements per BOM
2. **Revenue journal** — Full pay: Cash (`1000`) / F&B Revenue (`4100`). Partial: Cash + AR (`1300`) / F&B Revenue. See [accounting-module.md](./accounting-module.md).
3. **COGS journal** (if recipes exist) — Debit COGS (`5000`) / Credit Inventory (`1200`)

Requires chart of accounts from seed. If accounts are missing, completion still succeeds; journals are skipped.

COGS estimate uses recipe quantities × line qty (unit cost placeholder in phase 1).

## Events

| Event | When | Payload |
|-------|------|---------|
| `order.completed` | After complete | `{ orderId, branchId, organizationId, totalAmount, paidAmount }` |

## Permissions

| Role | Access |
|------|--------|
| OWNER, ADMIN | All POS permissions |
| CASHIER | `POS_READ`, `POS_WRITE` |
| KITCHEN | `POS_READ`, `POS_WRITE` (status updates) |

## Testing

```bash
pnpm --filter @erp/api test -- pos
pnpm --filter @erp/api test -- order-events.listener
pnpm --filter @erp/api test -- accounting-listeners
pnpm --filter @erp/web test:e2e pos
pnpm --filter @erp/web test:e2e kitchen
```

E2E coverage includes order lifecycle, partial payment, cancel, delete, menu category create, and kitchen prep/cancel queue flow (`e2e/pos.spec.ts`, `e2e/kitchen.spec.ts`).

Recipe/BOM editing is on **Inventory → Recipes (BOM)** tab (`/inventory`).

## Future (phase 2)

- [Offline POS](./phase2/offline-pos.md) — IndexedDB outbox, sync on reconnect
- [QR ordering](./phase2/qr-ordering.md) — guest PWA at `/order/:tableToken`

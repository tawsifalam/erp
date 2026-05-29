# PRD: Offline POS

## Problem

POS must operate during network outages.

## Solution

- Service worker caches menu and open orders
- IndexedDB outbox for mutations
- Sync API with idempotency keys and server-wins conflict for completed orders

## Acceptance

- Create/submit order offline; sync within 60s of reconnect
- No duplicate inventory movements on replay

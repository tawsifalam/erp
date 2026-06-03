# Local smoke tests (real stack)

Step-by-step coverage of [production-smoke-runbook.md](./production-smoke-runbook.md) against **localhost** with:

- Real PostgreSQL, Redis, MinIO (Docker)
- Real Nest API (`:3001`)
- Real PropelAuth access token ([testing your backend](https://docs.propelauth.com/recipes/testing-your-backend))
- **No** mocked `:3001` API routes (unlike `pnpm test:e2e`)

Specs run in order (`smoke-local-00` … `07`) with a **headed** browser by default. Element assertions use a **5 second** timeout (`playwright.config.ts` → `smoke-local` project).

---

## One-time setup

1. **Infrastructure**

   ```bash
   docker compose up -d postgres redis minio
   pnpm db:reset   # seed vendor, PMS, POS, HR, COA, etc.
   ```

2. **PropelAuth** — project configured for `http://localhost:3000` ([local-setup.md](./local-setup.md), [propelauth.md](./propelauth.md)).

3. **Create a test user** in the PropelAuth dashboard. Copy the **User ID** (UUID).

4. **Root `.env`**

   ```env
   PROPELAUTH_AUTH_URL=https://your-project.propelauth.com
   PROPELAUTH_API_KEY=...
   SMOKE_PROPELAUTH_USER_ID=<paste-user-id>
   SMOKE_PROPELAUTH_USER_EMAIL=you@example.com   # optional, for session mocks
   ```

---

## Run smoke

```bash
# Terminal A (optional if Playwright starts servers)
pnpm dev

# Terminal B — setup token + membership, then Playwright
pnpm smoke:local
```

`smoke:local` runs:

1. `pnpm smoke:local:setup` — PropelAuth `access_token`, `POST /api/auth/sync`, **always** links user to seed org as OWNER, writes `.playwright/smoke-auth.json` (gitignored).
2. `playwright test --project=smoke-local` — starts API + web if not already running; selects seed org/branch in the header before each navigation.

Setup always links your PropelAuth user to the **seed organization** (`Boulevard Hospitality Group` / `Main Hotel & Restaurant`), even if you belong to other orgs.

**Setup only** (API must be up):

```bash
pnpm dev
pnpm smoke:local:setup
pnpm --filter @erp/web test:smoke-local
```

**Headless** (faster CI-style run):

```bash
SMOKE_HEADLESS=1 pnpm --filter @erp/web test:smoke-local
# or
pnpm --filter @erp/web test:smoke-local:headless
```

---

## Reset data before smoke (clean run)

Smoke tests assume **seed data** (demo org, room 103 INQUIRY, chart of accounts, vendors, etc.). Leftover rows from earlier runs (extra branches, journals, integrations, smoke-created POs) can cause flaky or strict-mode failures.

### Standard reset (PostgreSQL only)

With Postgres/Redis/MinIO containers running:

```bash
docker compose up -d postgres redis minio
pnpm db:reset
```

`pnpm db:reset` runs `prisma migrate reset --force`, which:

1. **Drops** the application database
2. **Reapplies** all migrations
3. **Runs** `apps/api/prisma/seed.ts` (fresh demo data)

Then re-link your smoke user and run tests:

```bash
pnpm smoke:local:setup   # refreshes .playwright/smoke-auth.json
pnpm smoke:local
```

**One-liner** (reset DB + setup + full smoke suite):

```bash
pnpm db:reset && pnpm smoke:local
```

(`smoke:local` already invokes `smoke:local:setup` after the reset.)

Stop the API (or let `db:reset` run while the API is stopped) if you see connection errors during reset — Playwright’s smoke project can start API/web for you, or run `pnpm dev` in another terminal after reset.

### Full wipe (Postgres + Redis + MinIO volumes)

Use when `db:reset` is not enough (stale Docker volumes, old report files in MinIO, stuck BullMQ jobs):

```bash
# Optional: stop pnpm dev / API first
docker compose down -v
docker compose up -d postgres redis minio
pnpm db:reset
pnpm smoke:local
```

`-v` removes named volumes, so Redis queues and MinIO buckets start empty.

### What is cleared vs not

| Data | `pnpm db:reset` | `docker compose down -v` |
|------|-----------------|---------------------------|
| PostgreSQL (all app tables) | Yes | Yes (volume removed) |
| Redis (BullMQ jobs) | No | Yes |
| MinIO (report PDFs, payslips) | No | Yes |
| `.playwright/smoke-auth.json` | No | No — run `pnpm smoke:local:setup` |
| PropelAuth users/orgs | No | No (external service) |

PropelAuth accounts are unchanged; setup only adds/syncs your test user into the **new** seed organization in Postgres.

### When to reset

- Before a full smoke run you want comparable to CI
- After failed smoke left extra branches, journals, or integrations
- Troubleshooting: `Seed org not found`, room 103 lifecycle, duplicate UI text from accumulated data

See also [local-setup.md § Database](./local-setup.md#4-database).

---

## Automated coverage matrix

| Runbook / area | Spec file | Steps automated |
|----------------|-----------|-----------------|
| Prerequisites P0–P2 | `smoke-local-00-prereq` | API health, dashboard KPIs, all module shells |
| Prereq P6, P8 + Settings module | `smoke-local-01-settings` | Org rename, add/edit branch, guest/staff pools, custom pool, team join code UI, audit, notification toggle, branch access list, integrations, **channel export** |
| §6 PMS | `smoke-local-02-pms` | Room types, rooms, guests, packages, rates; new reservation + quote; 103 lifecycle; payment drawer; inclusions |
| §3 Procurement | `smoke-local-03-procurement` | Vendor drawer, PO create/submit/receive, **vendor payment** (Dr AP / Cr Bank), inventory stock, accounting journals |
| §4 Inventory & POS | `smoke-local-04-inventory-pos` | New item, movement, BOM; POS kitchen send, complete & pay drawer, menu category; kitchen display |
| §5 HR | `smoke-local-05-hr` | Add employee, attendance, **staff meals** drawer, payroll run (queued/completed) |
| Prereq P7 + §7 Reports | `smoke-local-06-accounting-reports` | Fiscal periods; post/reverse journal; P&L CSV; **trial balance PDF** |
| §8 Notifications | `smoke-local-07-notifications` | Bell + mark all read; low stock bell; report-ready bell |

### Manual only (second user / email / production infra)

| Runbook | Why manual |
|---------|------------|
| §1 Email invite end-to-end | Requires PropelAuth email + second account (team tab form is smoke-tested; submit not asserted) |
| §2 Join code approval | Requires second user without org |
| §8.3 Notification email | Requires `RESEND_API_KEY` and inbox check |
| §5.5 Payslip PDF download | Optional deep check; payroll job must complete + MinIO |
| §7.2 CSV open / debits=credits | Verify downloaded files by hand |
| P4–P5 Redis/MinIO reachability | Assumed via Docker; not asserted in UI |
| RBAC / Socket.IO deep checks | Optional runbook appendix |

Training screenshots (mocked E2E): [visual-guide.md](./visual-guide.md) · `pnpm visual-guide`.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Missing SMOKE_PROPELAUTH_USER_ID` | Set in `.env` |
| `access_token failed (401)` | Check `PROPELAUTH_API_KEY` |
| `auth/sync failed` | Start API: `pnpm --filter @erp/api dev` |
| `Seed org not found` | `pnpm db:reset` |
| `Missing .playwright/smoke-auth.json` | Run `pnpm smoke:local:setup` |
| Middleware redirect to login | Re-run setup; token may have expired (24h) |
| PMS lifecycle / room 103 | Re-run `pnpm db:reset` to restore INQUIRY seed |
| Report notification timeout | Ensure Redis is up; wait and re-run `07-notifications` |
| Stale data / odd smoke failures | [Reset data before smoke](#reset-data-before-smoke-clean-run) |

---

## Related

- [Production smoke runbook](./production-smoke-runbook.md)
- [Phase 1 sign-off](./phase1-signoff.md)

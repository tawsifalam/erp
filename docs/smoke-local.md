# Local smoke tests (real stack)

Step-by-step coverage of [production-smoke-runbook.md](./production-smoke-runbook.md) against **localhost** with:

- Real PostgreSQL, Redis, MinIO (Docker)
- Real Nest API (`:3001`)
- Real PropelAuth access token ([testing your backend](https://docs.propelauth.com/recipes/testing-your-backend))
- **No** mocked `:3001` API routes (unlike `pnpm test:e2e`)

Specs run in order (`smoke-local-00` … `07`) with a **headed** browser by default.

---

## One-time setup

1. **Infrastructure**

   ```bash
   docker compose -f infra/docker/docker-compose.yml up -d postgres redis minio
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

1. `pnpm smoke:local:setup` — PropelAuth `access_token`, `POST /api/auth/sync`, links user to **seed org** as OWNER, writes `.playwright/smoke-auth.json` (gitignored).
2. `playwright test --project=smoke-local` — starts API + web if not already running.

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

## Automated coverage matrix

| Runbook | Spec file | Steps automated |
|---------|-----------|-----------------|
| P0–P2 | `smoke-local-00-prereq` | API health, dashboard KPIs, all module shells |
| §1 Settings | `smoke-local-01-settings` | Org/branches, team join code + invite form, inventory pools drawer, audit log |
| §6 PMS | `smoke-local-02-pms` | Room types, rooms, guests, packages, rates; new reservation + quote; 103 lifecycle; payment drawer; inclusions |
| §3 Procurement | `smoke-local-03-procurement` | Vendor drawer, PO create/submit/receive, inventory stock, accounting journals |
| §4 Inventory & POS | `smoke-local-04-inventory-pos` | New item, movement, BOM; POS kitchen send, complete & pay drawer, menu category; kitchen display |
| §5 HR | `smoke-local-05-hr` | Add employee, attendance, staff meal drawers; payroll run (queued/completed) |
| Accounting + §7 Reports | `smoke-local-06-accounting-reports` | Add account drawer, post balanced journal, journals list; P&L and trial balance export queued |
| §8 Notifications | `smoke-local-07-notifications` | Bell + mark all read; low stock bell; report-ready bell |

### Manual only (second user / email / production infra)

| Runbook | Why manual |
|---------|------------|
| §1 Email invite end-to-end | Requires PropelAuth email + second account |
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

---

## Related

- [Production smoke runbook](./production-smoke-runbook.md)
- [Phase 1 sign-off](./phase1-signoff.md)

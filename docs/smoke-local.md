# Local smoke tests (real stack)

Automated subset of [production-smoke-runbook.md](./production-smoke-runbook.md) against **localhost** with:

- Real PostgreSQL, Redis, MinIO (Docker)
- Real Nest API (`:3001`)
- Real PropelAuth access token ([testing your backend](https://docs.propelauth.com/recipes/testing-your-backend))
- **No** mocked `:3001` API routes (unlike `pnpm test:e2e`)

Manual runbook items (email invite, join code, second user) remain in the production smoke doc.

---

## One-time setup

1. **Infrastructure**

   ```bash
   docker compose -f infra/docker/docker-compose.yml up -d postgres redis minio
   pnpm db:reset   # includes seed vendor "Fresh Foods Ltd" for procurement smoke
   ```

2. **PropelAuth** — project configured for `http://localhost:3000` ([local-setup.md](./local-setup.md), [propelauth.md](./propelauth.md)).

3. **Create a test user** in the PropelAuth dashboard (or use your own login user). Copy the **User ID** (UUID).

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

1. `pnpm smoke:local:setup` — PropelAuth `access_token`, `POST /api/auth/sync`, links user to **seed org** as OWNER if needed, writes `.playwright/smoke-auth.json` (gitignored).
2. `playwright test --project=smoke-local` — starts API + web if not already running.

**Setup only** (API must be up):

```bash
pnpm dev
pnpm smoke:local:setup
pnpm --filter @erp/web test:smoke-local
```

The `smoke-local` Playwright project runs **headed** (visible browser) by default.

**Headless** (faster, no window):

```bash
pnpm --filter @erp/web test:smoke-local:headless
```

---

## What is covered

| Automated | Manual runbook |
|-----------|----------------|
| API health | PropelAuth email invite |
| Dashboard | Join code approval |
| Procurement PO → receive | Full payroll + payslip download |
| Accounting journals visible | Notification email (Resend) |
| PMS rates + reservation drawer | PMS lifecycle / housekeeping |
| Reports export queued | |

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

---

## Related

- [Production smoke runbook](./production-smoke-runbook.md)
- [Phase 1 sign-off](./phase1-signoff.md)

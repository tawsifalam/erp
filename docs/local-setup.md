# Local development setup

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for Postgres, Redis, MinIO)

## 1. Clone and install

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
pnpm install
```

If install fails on **puppeteer** downloading Chrome (common in minimal Linux without `tar`/`unzip`), the repo sets `PUPPETEER_SKIP_DOWNLOAD=true` in [`.npmrc`](../.npmrc). You can also run:

```bash
PUPPETEER_SKIP_DOWNLOAD=true pnpm install
```

`pnpm generate:visual-guide-pdf` still needs Chrome or Playwright browsers (`pnpm test:e2e:install`), not Puppeteer’s bundled Chromium.

## 2. PropelAuth

1. Create a project at [PropelAuth](https://www.propelauth.com).
2. Copy Auth URL, API key, and verifier key from **Backend Integration**.
3. Set env vars (see [propelauth.md](./propelauth.md)):

```env
PROPELAUTH_AUTH_URL=https://your-project.propelauth.com
PROPELAUTH_API_KEY=...
NEXT_PUBLIC_AUTH_URL=https://your-project.propelauth.com
PROPELAUTH_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

4. In PropelAuth dashboard, set login redirect to `http://localhost:3000/api/auth/callback`.

## 3. Infrastructure

Run from the **repo root** (uses root `.env`):

```bash
docker compose up -d postgres redis minio
```

MinIO defaults: access key / secret `minioadmin` / `minioadmin` (see `.env`). Optional console: http://localhost:9001 — **not** required for the app; the API uses env keys. Reports and payslips need MinIO running before exports. Production details: [cloud-deployment.md § Object storage (MinIO)](./cloud-deployment.md#object-storage-minio).

## 4. Database

Prisma loads **`DATABASE_URL` from the repo root `.env`** ([`apps/api/prisma.config.ts`](../apps/api/prisma.config.ts)). You do not need a separate `apps/api/.env` for `pnpm db:reset` / `db:migrate`.

Single initial migration (`20260101000000_init`) — full schema including org onboarding (`joinCode`, join requests).

```bash
pnpm db:reset    # drop DB, apply init migration, run seed
```

Or step by step:

```bash
pnpm db:migrate
pnpm db:seed
```

**If you previously ran older migrations locally**, reset Postgres first:

```bash
docker compose down -v   # removes volumes
docker compose up -d postgres redis minio
pnpm db:reset
```

Demo seed uses `propelAuthOrgId` `demo-org-propelauth` and user `demo-admin-propelauth`. After PropelAuth login, the dashboard syncs your real user via `POST /api/auth/sync`.

## 5. Run apps

```bash
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/health
- Login: http://localhost:3000/api/auth/login

## 6. Tests

```bash
pnpm test                    # Unit tests only (fast)
pnpm test:e2e:install        # Once: Playwright browser
pnpm db:reset && pnpm test:e2e   # Mocked API browser tests (web only)

# API integration (real PostgreSQL, two orgs) — optional
docker compose up -d postgres redis
RUN_INTEGRATION=1 pnpm --filter @erp/api test:integration

# Real stack smoke (PropelAuth token + Postgres) — see docs/smoke-local.md
pnpm smoke:local:setup   # after db:reset or when switching orgs
pnpm smoke:local
```

## 7. API headers

Authenticated requests require:

- `Authorization: Bearer <access_token>` (from `/api/auth/access_token` on web)
- `X-Organization-Id: <uuid>`
- `X-Branch-Id: <uuid>` (for branch-scoped routes)

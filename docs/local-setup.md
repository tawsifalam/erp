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

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres redis minio
```

## 4. Database

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
docker compose -f infra/docker/docker-compose.yml down -v   # removes volumes
docker compose -f infra/docker/docker-compose.yml up -d postgres redis minio
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

# Real stack smoke (PropelAuth token + Postgres) — see docs/smoke-local.md
pnpm smoke:local
```

## 7. API headers

Authenticated requests require:

- `Authorization: Bearer <access_token>` (from `/api/auth/access_token` on web)
- `X-Organization-Id: <uuid>`
- `X-Branch-Id: <uuid>` (for branch-scoped routes)

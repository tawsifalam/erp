# Production deployment

For a **full step-by-step cloud deployment plan** (DNS, Docker, PropelAuth, TLS, migrations, Phase 1 smoke tests), see **[cloud-deployment.md](./cloud-deployment.md)**.

## Recommended topology

- **nginx** — TLS termination, routes `/` → web, `/api/` → API, `/socket.io/` → API
- **web** — Next.js standalone container
- **api** — NestJS container
- **postgres** — managed DB preferred
- **redis** — managed Redis for BullMQ
- **minio** — or S3-compatible object storage

## Build

```bash
pnpm install
pnpm db:generate
docker compose build
```

Run from the **repository root** so `./.env` is loaded (see [docker-compose.yml](../docker-compose.yml)). Do not use `-f infra/docker/docker-compose.yml` alone unless you pass `--env-file .env`.

Dockerfiles: [infra/docker/Dockerfile.api](../infra/docker/Dockerfile.api), [infra/docker/Dockerfile.web](../infra/docker/Dockerfile.web).

- **API:** builds workspace deps via `pnpm --filter @erp/api... build`; `pnpm deploy` produces a self-contained prod `node_modules` (fixes missing `@nestjs/core` at runtime).
- **Web:** Next.js `standalone` output; `NEXT_PUBLIC_*` must be passed as **build args** (see compose `web.build.args`). PropelAuth server env (`PROPELAUTH_*`) is runtime-only on web.

For a single-domain deploy behind nginx, rebuild web with `NEXT_PUBLIC_API_URL=https://your-domain.com` (same origin as the app).

## Environment

Set production values for all variables in `.env.example`. Update PropelAuth redirect URI to `https://your-domain.com/api/auth/callback`.

Use a **single public domain** for web + API paths when possible (`NEXT_PUBLIC_API_URL=https://your-domain.com`). See [cloud-deployment.md § Step 5](./cloud-deployment.md#step-5--production-environment-variables).

## Migrations

Run before deploy:

```bash
pnpm --filter @erp/api exec prisma migrate deploy
```

Do not run `db:seed` in production unless you want demo data.

## nginx

See [infra/nginx/nginx.conf](../infra/nginx/nginx.conf).

## Health checks

- API: `GET /api/health`
- Integrations stub: `GET /api/integrations/health`

## Phase 1 smoke test

After deploy, verify all modules: [cloud-deployment.md § Step 10](./cloud-deployment.md#step-10--smoke-test-phase-1-modules).

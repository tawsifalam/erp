# Production deployment

For a **full step-by-step cloud deployment plan** (DNS, Docker, PropelAuth, TLS, migrations, Phase 1 smoke tests), see **[cloud-deployment.md](./cloud-deployment.md)**.

For **VPS day-two ops** (inspect running containers, stop the stack completely, fix `compose down` / wrong project), see **[vps-docker-operations.md](./vps-docker-operations.md)**.

## Recommended topology

- **Host nginx** — TLS on 80/443, proxies to `127.0.0.1:3000` (web) and `:3001` (api)
- **web** / **api** — Docker (localhost bindings in prod)
- **postgres** / **redis** / **minio** — Docker on VPS, or managed services (Path B)

Config: [infra/nginx/host-nginx.conf.example](../infra/nginx/host-nginx.conf.example)

## Deploy scripts (VPS)

```bash
./scripts/deploy-prod.sh initial          # first time
./scripts/deploy-prod.sh update [--migrate]
./scripts/deploy-prod.sh nginx-install --domain app.yourdomain.com
```

See [cloud-deployment.md](./cloud-deployment.md). Local dev: `docker compose up` from repo root with `.env`.

Dockerfiles: [infra/docker/Dockerfile.api](../infra/docker/Dockerfile.api), [infra/docker/Dockerfile.web](../infra/docker/Dockerfile.web).

- **API:** builds workspace deps via `pnpm --filter @erp/api... build`; runner keeps the pnpm `node_modules` layout so externalized Nest/Prisma deps resolve.
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

Production: [infra/nginx/host-nginx.conf.example](../infra/nginx/host-nginx.conf.example) on the VPS host. Optional Docker nginx for local demos: [docker-compose.nginx.yml](../infra/docker/docker-compose.nginx.yml).

## Health checks

- API: `GET /api/health`
- Integrations stub: `GET /api/integrations/health`

## Phase 1 smoke test

After deploy, verify all modules: [cloud-deployment.md § Step 10](./cloud-deployment.md#step-10--smoke-test-phase-1) (summary) and the full [production-smoke-runbook.md](./production-smoke-runbook.md). Local automation: [smoke-local.md](./smoke-local.md).

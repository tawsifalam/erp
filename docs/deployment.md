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
docker compose -f infra/docker/docker-compose.yml build
```

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

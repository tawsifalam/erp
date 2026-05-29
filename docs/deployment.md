# Production deployment

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

## Migrations

Run before deploy:

```bash
pnpm --filter @erp/api exec prisma migrate deploy
```

## nginx

See [infra/nginx/nginx.conf](../infra/nginx/nginx.conf).

## Health checks

- API: `GET /api/health`
- Integrations stub: `GET /api/integrations/health`

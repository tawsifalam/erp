# Cloud deployment guide (Phase 1)

Step-by-step plan to deploy the hospitality ERP to production in the cloud. Covers everything in **Phase 1**: PMS, POS, kitchen, inventory, accounting, HR, payroll, reporting, and settings.

**Related:** [deployment.md](./deployment.md) (summary), [local-setup.md](./local-setup.md) (dev), [propelauth.md](./propelauth.md) (auth), [saas-launch-guide.md](./saas-launch-guide.md) (go-live checklist).

---

## What you are deploying

| Component | Role | Phase 1 usage |
|-----------|------|----------------|
| **web** | Next.js (standalone) | All UI: dashboard, PMS, POS, kitchen, inventory, accounting, HR, reports, settings |
| **api** | NestJS | REST + Socket.IO (kitchen, room status) |
| **postgres** | PostgreSQL 16 | All tenant and module data |
| **redis** | Redis 7 | BullMQ: payroll jobs, report exports |
| **minio / S3** | Object storage | Payroll artifacts, CSV report files |
| **nginx** | Reverse proxy | TLS, route `/` → web, `/api/` + `/socket.io/` → api |
| **PropelAuth** | SaaS (external) | Login, orgs, JWT validation |

```mermaid
flowchart TB
  User[Browser]
  PA[PropelAuth]
  NGINX[nginx + TLS]
  WEB[web :3000]
  API[api :3001]
  PG[(PostgreSQL)]
  RD[(Redis)]
  S3[(MinIO / S3)]

  User --> NGINX
  User --> PA
  NGINX --> WEB
  NGINX --> API
  WEB --> API
  API --> PG
  API --> RD
  API --> S3
  API --> PA
```

**Recommended URL layout (single domain):**

| URL | Target |
|-----|--------|
| `https://app.yourdomain.com/` | Next.js |
| `https://app.yourdomain.com/api/*` | NestJS API |
| `https://app.yourdomain.com/socket.io/*` | WebSocket (kitchen, rooms) |
| `https://app.yourdomain.com/api/auth/*` | PropelAuth Next.js routes (login callback) |

Using one domain avoids extra CORS complexity and matches [infra/nginx/nginx.conf](../infra/nginx/nginx.conf).

---

## Choose a cloud path

### Path A — Single VPS + Docker Compose (recommended for first production)

**Best for:** 1–5 pilot customers, low cost, fast setup.

| Provider | Example |
|----------|---------|
| DigitalOcean | Droplet 4 GB RAM / 2 vCPU (~$24/mo) |
| Hetzner | CX31 or similar |
| AWS | EC2 `t3.medium` |
| Linode / Akamai | Shared CPU 4 GB |

Postgres, Redis, MinIO run on the same VM via [docker-compose.yml](../infra/docker/docker-compose.yml), or use managed DB (Path B hybrid).

### Path B — Managed services (recommended before many tenants)

**Best for:** SaaS with backups, less ops on DB/cache.

| Service | Examples |
|---------|----------|
| PostgreSQL | RDS, Cloud SQL, DigitalOcean Managed DB, Supabase |
| Redis | ElastiCache, Upstash, DigitalOcean Managed Redis |
| Object storage | AWS S3, Cloudflare R2, DO Spaces |
| Compute | ECS Fargate, Railway, Render, Fly.io, same VPS for app only |

Path B steps differ only in **Steps 3–4** (connection strings instead of local containers). App containers and env vars stay the same.

---

## Prerequisites

Before starting:

- [ ] Domain name (e.g. `app.yourdomain.com`)
- [ ] [PropelAuth](https://www.propelauth.com) project (free tier works for pilots)
- [ ] Git repo access on the server or CI
- [ ] Docker 24+ and Docker Compose v2 on the server (Path A)
- [ ] `pnpm` 9+ locally or in CI for migrations (optional on server)

---

## Step 1 — Domain and DNS

1. Create an **A record** pointing to your server public IP:
   ```
   app.yourdomain.com  →  <SERVER_IP>
   ```
2. Wait for DNS propagation (often 5–30 minutes).
3. Optional: second record for staging:
   ```
   staging.yourdomain.com  →  <STAGING_IP>
   ```

---

## Step 2 — Server hardening (Path A)

SSH into the VPS:

```bash
# Create deploy user (optional but recommended)
adduser deploy
usermod -aG docker deploy

# Firewall — allow SSH, HTTP, HTTPS only
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER
```

Clone the repo:

```bash
git clone <your-repo-url> /opt/erp
cd /opt/erp
```

---

## Step 3 — Provision data stores

### Option 3A — All on VPS (docker-compose)

Start only infrastructure first:

```bash
cd /opt/erp
docker compose -f infra/docker/docker-compose.yml up -d postgres redis minio
docker compose -f infra/docker/docker-compose.yml ps
```

Default credentials match [.env.example](../.env.example) (`erp` / `erp`). **Change passwords in production** by editing `docker-compose.yml` and `DATABASE_URL`.

Create MinIO bucket (optional — API creates `erp-files` on startup if missing):

- Console: `http://<SERVER_IP>:9001` (do not expose publicly in prod; use SSH tunnel or remove port mapping)

### Option 3B — Managed PostgreSQL + Redis + S3

1. Create PostgreSQL 16 database; note connection string:
   ```
   postgresql://USER:PASSWORD@host:5432/hospitality_erp?sslmode=require
   ```
2. Create Redis instance; note URL:
   ```
   rediss://default:PASSWORD@host:6379
   ```
3. Create S3 bucket (e.g. `erp-files-prod`) and IAM keys.

For S3, set API env (MinIO client is S3-compatible):

```env
MINIO_ENDPOINT=s3.amazonaws.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=<AWS_ACCESS_KEY>
MINIO_SECRET_KEY=<AWS_SECRET_KEY>
MINIO_BUCKET=erp-files-prod
```

Skip `postgres`, `redis`, `minio` services in compose when using managed services; run only `api` and `web`.

---

## Step 4 — PropelAuth (production)

In the [PropelAuth dashboard](https://app.propelauth.com):

1. **Frontend integration**
   - Allowed redirect URLs: `https://app.yourdomain.com/api/auth/callback`
   - Default redirect after login: `/dashboard`
   - Logout redirect: `/`

2. **Backend integration** — copy:
   - Auth URL → `PROPELAUTH_AUTH_URL` / `NEXT_PUBLIC_AUTH_URL`
   - API key → `PROPELAUTH_API_KEY`
   - Verifier key (single line) → `PROPELAUTH_VERIFIER_KEY` (web)

3. If using **PropelAuth organizations**, ensure org creation aligns with your signup flow ([propelauth.md](./propelauth.md)).

See [propelauth.md](./propelauth.md) for sync behavior (`POST /api/auth/sync` on first dashboard visit).

---

## Step 5 — Production environment variables

Create `/opt/erp/.env` on the server (never commit this file):

```env
# --- Database & queue (adjust for managed services) ---
DATABASE_URL=postgresql://erp:STRONG_PASSWORD@postgres:5432/hospitality_erp
REDIS_URL=redis://redis:6379

# --- Object storage ---
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=STRONG_MINIO_USER
MINIO_SECRET_KEY=STRONG_MINIO_PASSWORD
MINIO_BUCKET=erp-files
MINIO_USE_SSL=false

# --- API ---
API_PORT=3001
CORS_ORIGIN=https://app.yourdomain.com
PROPELAUTH_AUTH_URL=https://YOUR_PROJECT.propelauth.com
PROPELAUTH_API_KEY=your-production-api-key

# --- Web (build-time + runtime for Next.js) ---
NEXT_PUBLIC_API_URL=https://app.yourdomain.com
NEXT_PUBLIC_AUTH_URL=https://YOUR_PROJECT.propelauth.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
PROPELAUTH_REDIRECT_URI=https://app.yourdomain.com/api/auth/callback
PROPELAUTH_VERIFIER_KEY=-----BEGIN PUBLIC KEY-----\n...
```

**Important:**

- `NEXT_PUBLIC_*` values are **baked into the web image at build time**. Rebuild `web` after changing them.
- Browser calls the API at `NEXT_PUBLIC_API_URL` + `/api/...`. With nginx on one domain, set it to `https://app.yourdomain.com` (not `:3001`).
- `CORS_ORIGIN` must match `NEXT_PUBLIC_APP_URL`.

Export for compose:

```bash
set -a && source /opt/erp/.env && set +a
```

---

## Step 6 — Build Docker images

From repo root:

```bash
cd /opt/erp
pnpm install
pnpm db:generate

docker compose -f infra/docker/docker-compose.yml build api web
```

Build `web` with public env args (if not using compose `environment` at runtime only):

```bash
docker build -f infra/docker/Dockerfile.web \
  --build-arg NEXT_PUBLIC_API_URL=https://app.yourdomain.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.yourdomain.com \
  -t erp-web:latest .
```

---

## Step 7 — Run database migrations

**Before** starting the API against production data:

```bash
# From your laptop or CI — recommended
DATABASE_URL="postgresql://..." pnpm --filter @erp/api exec prisma migrate deploy
```

Or from repo on server (with Node/pnpm installed):

```bash
cd /opt/erp
DATABASE_URL="postgresql://..." pnpm db:migrate
# Uses: prisma migrate dev — use migrate deploy in production:
pnpm --filter @erp/api exec prisma migrate deploy
```

**Do not run `pnpm db:seed` in production** unless you want demo data. Real customers: create orgs via **Settings** after login.

Migrations include Phase 1 schema: tenants, PMS, POS, inventory pools, staff meals, report jobs, text status columns, etc.

---

## Step 8 — Start application services

Update [docker-compose.yml](../infra/docker/docker-compose.yml) production overrides:

- Set `CORS_ORIGIN`, `NEXT_PUBLIC_*`, PropelAuth vars from `.env`
- Remove public ports on `postgres` / `redis` / `minio` if only accessed inside Docker network

Start API and web:

```bash
docker compose -f infra/docker/docker-compose.yml up -d api web
docker compose -f infra/docker/docker-compose.yml logs -f api web
```

Verify internally:

```bash
curl -s http://localhost:3001/api/health
# {"status":"ok"}
```

---

## Step 9 — nginx and TLS

### Add nginx to Compose (recommended)

Extend compose or run nginx container mounting [infra/nginx/nginx.conf](../infra/nginx/nginx.conf):

```yaml
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - api
      - web
```

For TLS, use **Certbot** on the host or **nginx-proxy + acme-companion**.

### Quick TLS with Certbot (host nginx)

1. Install certbot: `apt install certbot python3-certbot-nginx`
2. Point nginx at `app.yourdomain.com` → proxy to `127.0.0.1:3000` and `127.0.0.1:3001` per [nginx.conf](../infra/nginx/nginx.conf)
3. Run: `certbot --nginx -d app.yourdomain.com`

Ensure **WebSocket** headers for `/socket.io/` (already in nginx.conf) — required for kitchen display and PMS room updates.

---

## Step 10 — Smoke test (Phase 1 modules)

Use `https://app.yourdomain.com` in a browser.

| # | Test | Pass criteria |
|---|------|----------------|
| 1 | **Auth** | Login via PropelAuth → land on `/dashboard` |
| 2 | **Sync** | First visit creates user/org in DB |
| 3 | **Settings** | Create branch; inventory pools `guest` / `staff` visible |
| 4 | **PMS** | Create guest, room, reservation; check-in/out |
| 5 | **POS** | Create order, send to kitchen, complete & pay |
| 6 | **Kitchen** | `/pos/kitchen` — ticket appears; mark preparing → ready |
| 7 | **Inventory** | Item list, record movement, recipe saves |
| 8 | **Accounting** | Journals visible after POS complete (if CoA seeded) |
| 9 | **HR** | Employee, staff meal recipe, payroll run queues |
| 10 | **Reports** | Export CSV; job completes; download works |
| 11 | **Realtime** | PMS room status updates without refresh (Socket.IO) |
| 12 | **Health** | `GET /api/health` returns 200 |

API check:

```bash
curl -s https://app.yourdomain.com/api/health
```

---

## Step 11 — Production operations

### Backups

| Asset | Method |
|-------|--------|
| PostgreSQL | Daily `pg_dump` or managed automatic backups |
| MinIO/S3 | Versioning + lifecycle rules on bucket |
| Redis | Ephemeral OK for queues; no critical long-term state |

Example cron (Postgres on VPS):

```bash
0 2 * * * pg_dump "$DATABASE_URL" | gzip > /backups/erp-$(date +\%F).sql.gz
```

### Monitoring

- Uptime: ping `https://app.yourdomain.com/api/health`
- Logs: `docker compose logs -f api web`
- Errors: Sentry (optional) on API + web
- Redis queue depth: monitor if payroll/report jobs stall

### Updates (deploy new version)

```bash
cd /opt/erp
git pull
pnpm install && pnpm db:generate
docker compose -f infra/docker/docker-compose.yml build api web
pnpm --filter @erp/api exec prisma migrate deploy   # with production DATABASE_URL
docker compose -f infra/docker/docker-compose.yml up -d api web
```

Zero-downtime: run two API replicas behind nginx (Phase 2 ops).

### Secrets

- Store `.env` outside git; use provider secret manager at scale
- Rotate PropelAuth API key and DB password periodically

---

## Environment reference

### API (required)

| Variable | Example (production) |
|----------|----------------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/hospitality_erp` |
| `REDIS_URL` | `redis://redis:6379` or managed URL |
| `CORS_ORIGIN` | `https://app.yourdomain.com` |
| `PROPELAUTH_AUTH_URL` | `https://xxx.propelauth.com` |
| `PROPELAUTH_API_KEY` | From PropelAuth dashboard |
| `MINIO_*` | See Step 5 |

### Web (required at build)

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://app.yourdomain.com` |
| `NEXT_PUBLIC_AUTH_URL` | `https://xxx.propelauth.com` |
| `NEXT_PUBLIC_APP_URL` | `https://app.yourdomain.com` |
| `PROPELAUTH_REDIRECT_URI` | `https://app.yourdomain.com/api/auth/callback` |
| `PROPELAUTH_API_KEY` | Same as API |
| `PROPELAUTH_VERIFIER_KEY` | Single-line public key |

Validated by `packages/config/src/env.ts`.

---

## Staging environment (recommended)

Duplicate Steps 1–11 with:

- `staging.yourdomain.com`
- Separate PropelAuth test project or staging org
- Separate database (never share prod DB)
- Run `db:seed` on staging only for QA

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Login loop | Wrong `PROPELAUTH_REDIRECT_URI` | Match PropelAuth dashboard exactly |
| API 401 | Token not sent | Check `/api/auth/access_token`; user logged in |
| CORS errors | `CORS_ORIGIN` mismatch | Set to exact web origin (scheme + host) |
| Kitchen not updating | WebSocket blocked | nginx `/socket.io/` upgrade headers |
| Reports stuck PENDING | Redis down | Check `REDIS_URL`; `docker compose ps redis` |
| Payroll no file | MinIO/S3 unavailable | Check API logs; storage disables gracefully |
| Blank API calls from browser | Wrong `NEXT_PUBLIC_API_URL` | Rebuild web with correct public URL |

---

## Phase 1 vs later phases

This guide covers **Phase 1 only**. Not required for initial deploy:

- Stripe billing ([saas-launch-guide.md](./saas-launch-guide.md))
- Procurement, GL reports ([erp-completeness-roadmap.md](./erp-completeness-roadmap.md))
- Channel manager, offline POS ([phase2/README.md](./phase2/README.md))

Add CI/CD (GitHub Actions → build images → deploy) once pilots are stable.

---

## Quick checklist

```
[ ] DNS → server
[ ] Postgres + Redis + storage ready
[ ] PropelAuth production URLs configured
[ ] .env production values set
[ ] docker build api + web
[ ] prisma migrate deploy
[ ] compose up api web (+ postgres redis minio nginx)
[ ] TLS certificate active
[ ] /api/health OK
[ ] Login + Phase 1 smoke tests pass
[ ] Backups scheduled
```

---

## Related docs

- [deployment.md](./deployment.md) — topology summary
- [local-setup.md](./local-setup.md) — development environment
- [propelauth.md](./propelauth.md) — authentication
- [saas-launch-guide.md](./saas-launch-guide.md) — pilots and billing
- [app-workflow-guide.md](./app-workflow-guide.md) — module behavior after deploy

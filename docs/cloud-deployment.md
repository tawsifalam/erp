# Cloud deployment guide (Phase 1)

Step-by-step plan to deploy the hospitality ERP to production. Covers **Phase 1** modules (PMS, POS, kitchen, inventory, accounting, HR, payroll, reporting, settings).

**Related:** [deployment.md](./deployment.md) (summary), [vps-docker-operations.md](./vps-docker-operations.md) (stop/inspect/rebuild), [local-setup.md](./local-setup.md) (dev), [auth.md](./auth.md) (authentication).

---

## Production architecture (this project)

| Layer | Component | Notes |
|-------|-----------|--------|
| Edge | **Host nginx** (systemd) | TLS on 80/443, proxies to localhost |
| App | **web**, **api** (Docker) | Published on `127.0.0.1:3000` / `3001` only |
| Data | **postgres**, **redis**, **minio** (Docker) | Not published on host in prod (`docker-compose.prod.yml`) |
| Auth | **First-party JWT** (API + Redis) | In-app |

We do **not** run nginx in Docker for production. Certbot and `/etc/nginx` own the public ports. App containers stay on the internal Compose network plus localhost bindings.

```mermaid
flowchart TB
  User[Browser]
  HN[Host nginx TLS]
  WEB[web 127.0.0.1:3000]
  API[api 127.0.0.1:3001]
  PG[(PostgreSQL)]
  RD[(Redis)]
  S3[(MinIO)]

  User --> HN
  HN --> WEB
  HN --> API
  WEB --> API
  API --> PG
  API --> RD
  API --> S3
```

**Single-domain URLs** (recommended):

| URL | Target |
|-----|--------|
| `https://app.yourdomain.com/` | Next.js |
| `https://app.yourdomain.com/api/*` | NestJS (including `/api/auth/*`) |
| `https://app.yourdomain.com/socket.io/*` | WebSocket |
| `https://app.yourdomain.com/auth/login` | Next.js login page |

Reference config: [infra/nginx/host-nginx.conf.example](../infra/nginx/host-nginx.conf.example). Route rules match the legacy [infra/nginx/nginx.conf](../infra/nginx/nginx.conf) (Docker upstream names `api`/`web` → use `127.0.0.1` on the host).

---

## Standard Compose command (use everywhere)

From `/opt/erp`, use the **same** invocation for `up`, `ps`, `logs`, `exec`, `down`, and rebuilds:

```bash
cd /opt/erp
COMPOSE=(
  --env-file /opt/erp/.env
  -f /opt/erp/docker-compose.yml
  -f /opt/erp/infra/docker/docker-compose.prod.yml
  -f /opt/erp/infra/docker/docker-compose.prod-host-nginx.yml
)
```

- Root [docker-compose.yml](../docker-compose.yml) includes [infra/docker/docker-compose.yml](../infra/docker/docker-compose.yml).
- `--env-file` supplies secrets and `NEXT_PUBLIC_*` **build args** (do **not** `source .env` — PEM keys break the shell).
- `prod` hides Postgres/Redis/MinIO ports on the host.
- `prod-host-nginx` binds api/web to **localhost only**.

**Automated deploys** (same Compose files as above):

| Command | When |
|---------|------|
| `./scripts/deploy-prod.sh initial` | First deploy on a VPS (starts postgres/redis/**minio**, waits for health, then api/web) |
| `./scripts/deploy-prod.sh update` | After `git pull` / code changes (default: rebuild all, `--no-cache`; ensures minio healthy before api) |
| `./scripts/deploy-prod.sh update --migrate` | Update + Prisma migrations |
| `./scripts/deploy-prod.sh migrate` | `prisma migrate deploy` in the **api** container |
| `./scripts/deploy-prod.sh reset` | Wipe data volumes + reapply schema (`--yes`, `--db-only`, `--seed`) |
| `./scripts/deploy-prod.sh nginx-install --domain app.yourdomain.com` | Host nginx site (HTTP bootstrap first, then HTTPS after certbot) |

Legacy alias: `./scripts/docker-rebuild-prod.sh` → `deploy-prod.sh update`.

**Do not** run only `-f infra/docker/docker-compose.yml` from `/opt/erp` without `--env-file` — Compose may use the wrong project directory and miss `.env`.

---

## Choose a cloud path

### Path A — Single VPS + Docker Compose (recommended for first production)

**Best for:** 1–5 pilot customers, low cost.

| Provider | Example |
|----------|---------|
| Hetzner | CX31 or similar |
| DigitalOcean | Droplet 4 GB RAM |
| AWS | EC2 `t3.medium` |

Bundled Postgres, Redis, MinIO on the VM; **host nginx** in front.

### Path B — Managed PostgreSQL / Redis / S3

**Best for:** Less DB ops before many tenants.

Skip `postgres`, `redis`, `minio` in `docker compose up`. Set connection strings in `/opt/erp/.env`.

**Important:** The default `api` service in [docker-compose.yml](../infra/docker/docker-compose.yml) sets in-container `DATABASE_URL` / `REDIS_URL` / `MINIO_*` for the **bundled** stack. For Path B you must supply a compose override that removes those keys or sets managed URLs — `.env` alone is not enough (`environment` wins over `env_file`). Path A steps below assume bundled data services.

---

## Prerequisites

- [ ] Domain (e.g. `app.yourdomain.com`)
- [ ] JWT secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — min 16 chars; generate with `openssl rand -base64 32`)
- [ ] VPS with Docker 24+ and Compose v2
- [ ] **nginx** and **certbot** on the host (`apt install nginx certbot python3-certbot-nginx`)
- [ ] Git clone at `/opt/erp`

---

## Step 1 — Domain and DNS

```
app.yourdomain.com  A  →  <SERVER_IP>
```

Wait for propagation (often 5–30 minutes). Optional staging: `staging.yourdomain.com`.

---

## Step 2 — Server setup

```bash
# Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Host nginx + TLS tooling
apt update
apt install -y nginx certbot python3-certbot-nginx

# App code
git clone <your-repo-url> /opt/erp
cd /opt/erp
```

Do **not** disable host nginx for this deployment model.

---

## Step 3 — Data stores (Path A)

```bash
cd /opt/erp
docker compose "${COMPOSE[@]}" up -d postgres redis minio
docker compose "${COMPOSE[@]}" ps
```

Default DB credentials are in [docker-compose.yml](../infra/docker/docker-compose.yml) (`erp` / `erp`). **Change** `POSTGRES_PASSWORD` in compose and matching URL in `api.environment` before real customers.

`./scripts/deploy-prod.sh initial` and `update` (api/all) wait for **minio** to be healthy before starting or recreating **api**. See [Object storage (MinIO)](#object-storage-minio) for credentials, downloads, and troubleshooting.

---

## Object storage (MinIO)

MinIO stores **report export files** (CSV/PDF) and **payroll payslip PDFs**. The ERP app does **not** require logging into the MinIO web console — the API connects with access keys from environment variables.

### What uses storage

| Feature | Stored as | Download path |
|---------|-----------|---------------|
| Reports (`/reports`) | `reports/{jobId}.csv` or `.pdf` in bucket `erp-files` | Web **Download** button → `GET /api/reporting/jobs/:id/download` (auth required) |
| Payroll payslips (`/hr`) | `payroll/{runId}.pdf` | **Download payslip** → `GET /api/payroll/runs/:id/payslip` |

Exports run in BullMQ; if storage is down, jobs fail with `File storage is unavailable` instead of completing without a file.

### Path A — bundled MinIO (recommended first deploy)

Compose runs MinIO on the internal Docker network. The **api** container receives (from [docker-compose.yml](../infra/docker/docker-compose.yml) `api.environment`):

| Variable | In-container value (Path A) |
|----------|----------------------------|
| `MINIO_ENDPOINT` | `minio` |
| `MINIO_PORT` | `9000` |
| `MINIO_USE_SSL` | `false` |
| `MINIO_BUCKET` | `erp-files` (default in code if unset) |
| `MINIO_ACCESS_KEY` | `minioadmin` (dev default — **change for production**) |
| `MINIO_SECRET_KEY` | `minioadmin` (dev default — **change for production**) |

**Rotate credentials before real customers:** set `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` on the `minio` service and matching `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` on `api.environment` in compose (or a prod override file). Restart `minio` and `api` after changes.

**Do not publish** ports 9000/9001 on the public internet — [docker-compose.prod.yml](../infra/docker/docker-compose.prod.yml) clears host bindings. API reaches MinIO via Docker DNS (`minio:9000`).

**Optional web console** (browse buckets manually only):

```bash
# From your laptop — tunnel to the VPS MinIO console
ssh -L 9001:127.0.0.1:9001 user@your-vps
# Open http://localhost:9001 — login with MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
```

### Path B — managed S3-compatible storage

Skip the `minio` service. Point the API at your provider (AWS S3, Cloudflare R2, etc.) by overriding `MINIO_*` on the **api** service:

```env
MINIO_ENDPOINT=s3.amazonaws.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET=your-bucket-name
```

For Path B you must **remove or replace** the bundled `MINIO_*` entries in compose `api.environment` — compose `environment` wins over `.env` alone. Use a prod override file or managed-service-specific endpoint/region settings per your provider’s S3 API docs.

### Local development (API on host, MinIO in Docker)

When running `pnpm dev` on the host (not inside the api container), set in repo root `.env`:

```env
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=erp-files
MINIO_USE_SSL=false
```

See [.env.example](../.env.example) and [local-setup.md](./local-setup.md).

### Verify storage (production smoke P5)

```bash
# MinIO container healthy (Path A)
docker compose "${COMPOSE[@]}" ps minio

# API can reach storage — queue a report export in the UI, wait for COMPLETED, download from /reports
# Or check API logs: no "MinIO unavailable, storage uploads disabled" after startup
docker compose "${COMPOSE[@]}" logs api | grep -i minio
```

Full checklist: [production-smoke-runbook.md](./production-smoke-runbook.md) prerequisite **P5**.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| `File storage is unavailable` on export | API started before MinIO, or wrong `MINIO_*` | Ensure `minio` is running; restart `api`. API retries MinIO on the next upload/download if it was down at boot. |
| Report job `COMPLETED` but download 404 (older jobs) | Job finished while storage was disabled | Re-export the report, or download again (API regenerates CSV/PDF when the object is missing). |
| `MinIO unavailable` in API logs at startup | Wrong endpoint, credentials, or minio not up | Path A: `MINIO_ENDPOINT=minio` inside api container, not `localhost`. Recreate api after fixing compose. |
| Cannot open MinIO console on VPS IP:9001 | Ports intentionally not published in prod | Use SSH tunnel to port 9001 (see above). |

---

## Step 4 — JWT authentication

Generate strong secrets and set in `/opt/erp/.env` (see [auth.md](./auth.md)):

```env
JWT_ACCESS_SECRET=<random-32+-chars>
JWT_REFRESH_SECRET=<different-random-32+-chars>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
AUTH_COOKIE_NAME=erp_refresh
APP_URL=https://app.yourdomain.com
```

After deploy, run [production-smoke-runbook.md](./production-smoke-runbook.md).

---

## Step 5 — `/opt/erp/.env`

Create once (never commit):

```env
# --- App secrets & public URLs (required) ---
CORS_ORIGIN=https://app.yourdomain.com
JWT_ACCESS_SECRET=your-production-access-secret-min-16-chars
JWT_REFRESH_SECRET=your-production-refresh-secret-min-16-chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
AUTH_COOKIE_NAME=erp_refresh
APP_URL=https://app.yourdomain.com
NEXT_PUBLIC_API_URL=https://app.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com

API_PORT=3001
```

**Bundled Postgres/Redis/MinIO (Path A):** Compose injects in-container `DATABASE_URL`, `REDIS_URL`, and `MINIO_*` for service hostnames `postgres`, `redis`, `minio`. You do **not** need `localhost` in `.env` for the API container. Optional duplicates in `.env` for `pg_dump` cron on the host:

```env
DATABASE_URL=postgresql://erp:STRONG_PASSWORD@127.0.0.1:5432/hospitality_erp
```

(Only if you expose Postgres to localhost for backups — default prod overlay does **not** publish 5432.)

**Rules:**

- `NEXT_PUBLIC_*` are **baked in at `docker compose build`** — rebuild `web` after changes.
- `NEXT_PUBLIC_API_URL` = public app origin (same domain as nginx), not `:3001`.
- `CORS_ORIGIN` must match `NEXT_PUBLIC_APP_URL`.
- Do **not** `source .env` for deploy scripts; they use `--env-file` via [scripts/lib/compose-prod.sh](../scripts/lib/compose-prod.sh).

Optional notification email (API container reads these from the same `.env`):

```env
RESEND_API_KEY=re_...
EMAIL_FROM=ERP <notifications@yourdomain.com>
```

See [Email (Resend)](#email-resend) below.

---

## Email (Resend)

| Mail | Configuration |
|------|----------------|
| Password reset, **Settings → Team invite** | `RESEND_API_KEY` + `EMAIL_FROM` in `/opt/erp/.env` |
| ERP alerts (low stock, payroll complete/failed) | Same Resend keys |

**Resend setup:** Create an API key at [resend.com](https://resend.com), verify your sending domain (DNS), set `EMAIL_FROM` to an address on that domain. Without `RESEND_API_KEY`, in-app notifications still work; the API logs email bodies instead of sending.

**Production check:** [production-smoke-runbook.md](./production-smoke-runbook.md) — §1 (email invite), §8.3 (low stock or payroll email when Resend is set). Low-stock email goes to Owner/Admin/Accountant roles with **Low stock alerts → Email** enabled in Settings.

**Local test:** Add keys to repo root `.env`, restart `pnpm dev`, ensure Redis is up, record a large **OUT** adjustment on seed item Rice (`INV-001`, threshold 10 kg) while logged in as an admin on the seed org.

---

## Step 6–8 — Deploy application (automated)

From `/opt/erp` after `.env` is ready:

```bash
chmod +x scripts/deploy-prod.sh scripts/deploy-prod-initial.sh scripts/deploy-prod-update.sh scripts/deploy-prod-reset.sh
./scripts/deploy-prod.sh initial
```

This runs: `pnpm install` → `db:generate` → start postgres/redis/minio → build api+web → start api+web → `prisma migrate deploy` → local health check on `127.0.0.1:3001`.

**Does not** install or start host nginx — do [Step 9](#step-9--host-nginx-and-tls) after `initial` (requires `apt install nginx` from [Step 2](#step-2--server-setup)).

**Updates** (routine deploy after code changes):

```bash
./scripts/deploy-prod.sh update              # git pull + rebuild all + recreate
./scripts/deploy-prod.sh update --migrate   # + migrations when schema changed
./scripts/deploy-prod.sh update web          # UI / NEXT_PUBLIC_* only
```

Manual equivalent:

```bash
docker compose "${COMPOSE[@]}" build api web
docker compose "${COMPOSE[@]}" up -d api web
```

Expected containers (project `erp`): **postgres, redis, minio, api, web** — five services.

```bash
./scripts/deploy-prod.sh health
./scripts/deploy-prod.sh logs
```

**Do not** run `pnpm db:seed` in production unless you want demo data.

**Clean reset** (wipe Postgres/Redis/MinIO volumes and reapply schema):

```bash
./scripts/deploy-prod.sh reset          # interactive — type RESET to confirm
./scripts/deploy-prod.sh reset --yes    # empty DB, no demo seed
./scripts/deploy-prod.sh reset --seed   # staging: includes demo seed
```

After reset, users sign in at `/auth/login` (or register) and complete onboarding to create or join an organization.

---

## Step 9 — Host nginx and TLS

**Prerequisite:** host nginx packages from [Step 2](#step-2--server-setup) (`apt install nginx certbot python3-certbot-nginx`). Without that, `/etc/nginx` does not exist and install will fail.

**Recommended** — use the install helper (three steps):

```bash
# 1. HTTP-only bootstrap (works before TLS certs exist)
./scripts/deploy-prod.sh nginx-install --domain app.yourdomain.com

# 2. Obtain certificate (Let's Encrypt)
sudo certbot --nginx -d app.yourdomain.com

# 3. Install full HTTPS config (redirect HTTP→HTTPS, all proxy routes)
./scripts/deploy-prod.sh nginx-install --domain app.yourdomain.com
```

The helper picks `host-nginx.bootstrap.conf.example` when certs are missing, then `host-nginx.conf.example` after certbot. It creates `sites-available` / `sites-enabled` if needed (Debian/Ubuntu).

**Manual install** — only if you prefer editing files by hand. Do **not** copy the full HTTPS example before certs exist (`nginx -t` will fail on missing `ssl_certificate` paths). Use the bootstrap file first, or run certbot, then copy [host-nginx.conf.example](../infra/nginx/host-nginx.conf.example).

Cloudflare origin certs: adjust `ssl_certificate` paths in the site file instead of certbot.

Confirm WebSocket routes: `/socket.io/` must have `Upgrade` headers (included in both nginx examples).

Public check:

```bash
curl -s https://app.yourdomain.com/api/health
```

**Optional — nginx in Docker:** for local all-in-docker demos only, [docker-compose.nginx.yml](../infra/docker/docker-compose.nginx.yml) + [nginx.conf](../infra/nginx/nginx.conf). Not used on the production VPS.

---

## Step 10 — Smoke test (Phase 1)

Use the full checklist in **[production-smoke-runbook.md](./production-smoke-runbook.md)** (prerequisites P1–P8, sections 1–8, sign-off). Locally, `pnpm smoke:local` automates most module flows — see [smoke-local.md](./smoke-local.md).

Browser: `https://app.yourdomain.com`

| # | Test | Pass |
|---|------|------|
| 1 | Auth | Email login at `/auth/login` → `/dashboard` |
| 2 | Sync | First visit creates user/org (or onboarding join) |
| 3 | Settings | Org rename, add/edit branch, guest/staff pools, team join code, notification prefs, integrations + channel export |
| 4 | PMS | Guest, room, reservation, check-in/out, rates quote |
| 5 | POS | Order → kitchen → pay |
| 6 | Kitchen | Ticket flow |
| 7 | Inventory | Items, movements, COGS |
| 8 | Accounting | Journals after POS/procurement |
| 9 | HR | Employee, payroll run |
| 10 | Reports | CSV export completes |
| 11 | Realtime | PMS room updates (Socket.IO) |
| 12 | Health | `GET /api/health` → 200 |

**Manual on production:** email invite (runbook §1), join-code approval (§2), notification email when Resend is configured (§8.3).

---

## Step 11 — Operations

See [vps-docker-operations.md](./vps-docker-operations.md) for stop/start, `compose ls` vs `ps`, and force-remove.

### Deploy code changes

```bash
cd /opt/erp
./scripts/deploy-prod.sh update
./scripts/deploy-prod.sh update --migrate   # when prisma/migrations changed
./scripts/deploy-prod.sh update web         # frontend only
```

### Backups

```bash
# Example cron — use a URL that reaches Postgres from the host
0 2 * * * pg_dump "postgresql://erp:PASS@127.0.0.1:5432/hospitality_erp" | gzip > /backups/erp-$(date +\%F).sql.gz
```

### Monitoring

- Uptime: `https://app.yourdomain.com/api/health`
- Logs: `docker compose "${COMPOSE[@]}" logs -f api web`
- Host nginx: `sudo journalctl -u nginx -f`

---

## Environment reference

| Variable | Production example |
|----------|-------------------|
| `NEXT_PUBLIC_API_URL` | `https://app.yourdomain.com` |
| `NEXT_PUBLIC_APP_URL` | `https://app.yourdomain.com` |
| `CORS_ORIGIN` | Same as app URL |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Strong random strings (min 16 chars) |
| `APP_URL` | `https://app.yourdomain.com` (invite + reset links) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional; required for invites and password reset email |
| In-container DB (Path A) | Set by compose `api.environment`, not `.env` |
| `MINIO_*` (Path A) | Compose sets `MINIO_ENDPOINT=minio`; rotate keys — see [Object storage (MinIO)](#object-storage-minio) |
| `MINIO_*` (Path B) | Your S3-compatible endpoint, bucket, and keys on `api` only |

Validated in `packages/config/src/env.ts`.

---

## Staging

Duplicate with `staging.yourdomain.com`, separate DB and JWT secrets. `db:seed` on staging only.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|--------|-----|
| `Can't reach database server at localhost:5432` in **api** container | `.env` has localhost; overrides missing or api not recreated | Recreate api after pull; bundled stack uses compose `api.environment` |
| `Bind for :::6379` / `5432` | Host services conflict | Use `docker-compose.prod.yml`; `ss -tlnp` |
| `Bind for 0.0.0.0:80 failed` | Starting compose **nginx** (removed from default) | Use host nginx only; do not add `docker-compose.nginx.yml` on VPS |
| 502 from public URL | Host nginx up, api/web down | `curl 127.0.0.1:3001/api/health`; `docker compose "${COMPOSE[@]}" ps` |
| Login loop / stuck loading | Nginx routing `/api/auth/*` to web instead of API | All `/api/` → api (port 3001); see [auth.md](./auth.md) |
| Auth API 404 on login | Same nginx misroute | Re-run `nginx-install`; remove legacy `location /api/auth/` → web |
| CORS errors | `CORS_ORIGIN` ≠ app URL | Align with `NEXT_PUBLIC_APP_URL` |
| Kitchen not updating | WebSocket blocked | Check `/socket.io/` in host nginx config |
| `cp: cannot create ... /etc/nginx/sites-available/erp` | Host nginx not installed | `sudo apt install -y nginx certbot python3-certbot-nginx`; then `nginx-install` |
| `nginx -t` fails on first install | Full HTTPS config before certs | Use `nginx-install` (bootstrap), then certbot, then `nginx-install` again |
| Site down after `reset` | Docker restarted; host nginx separate | `./scripts/deploy-prod.sh health`; `sudo systemctl start nginx` |
| `prisma migrate deploy` schema path error | Wrong path inside api container | Use `./scripts/deploy-prod.sh migrate` (absolute schema path) |
| Old UI after `git pull` | Image not rebuilt | `./scripts/deploy-prod.sh update web` |
| `compose ps` empty, site works | Wrong cwd/project | `cd /opt/erp`; see [vps-docker-operations.md](./vps-docker-operations.md) |
| `SOURCE_REV` warning | Harmless on `ps` | Export for builds: `export SOURCE_REV=$(git rev-parse HEAD)` |
| `File storage is unavailable` | MinIO down or api started before minio | Start minio; restart api; see [Object storage (MinIO)](#object-storage-minio) |
| Report download 404 | Stale job from storage outage | Re-export or retry download (API regenerates if object missing) |

---

## Quick checklist

```
[ ] DNS → VPS
[ ] apt install nginx certbot python3-certbot-nginx (Step 2)
[ ] /opt/erp/.env (JWT_*, APP_URL, NEXT_PUBLIC_*, CORS; optional Resend — see Email section)
[ ] ./scripts/deploy-prod.sh initial → curl http://127.0.0.1:3001/api/health
[ ] ./scripts/deploy-prod.sh nginx-install --domain <domain>  (HTTP bootstrap)
[ ] sudo certbot --nginx -d <domain>
[ ] ./scripts/deploy-prod.sh nginx-install --domain <domain>  (full HTTPS)
[ ] curl https://<domain>/api/health
[ ] MinIO credentials rotated (not default `minioadmin`) — [Object storage (MinIO)](#object-storage-minio)
[ ] Phase 1 smoke tests (include P5 MinIO / report download)
[ ] Backups scheduled
```

---

## Related docs

- [vps-docker-operations.md](./vps-docker-operations.md)
- [deployment.md](./deployment.md)
- [saas-launch-guide.md](./saas-launch-guide.md)

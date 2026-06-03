# Cloud deployment guide (Phase 1)

Step-by-step plan to deploy the hospitality ERP to production. Covers **Phase 1** modules (PMS, POS, kitchen, inventory, accounting, HR, payroll, reporting, settings).

**Related:** [deployment.md](./deployment.md) (summary), [vps-docker-operations.md](./vps-docker-operations.md) (stop/inspect/rebuild), [local-setup.md](./local-setup.md) (dev), [propelauth.md](./propelauth.md) (auth).

---

## Production architecture (this project)

| Layer | Component | Notes |
|-------|-----------|--------|
| Edge | **Host nginx** (systemd) | TLS on 80/443, proxies to localhost |
| App | **web**, **api** (Docker) | Published on `127.0.0.1:3000` / `3001` only |
| Data | **postgres**, **redis**, **minio** (Docker) | Not published on host in prod (`docker-compose.prod.yml`) |
| Auth | **PropelAuth** (SaaS) | External |

We do **not** run nginx in Docker for production. Certbot and `/etc/nginx` own the public ports. App containers stay on the internal Compose network plus localhost bindings.

```mermaid
flowchart TB
  User[Browser]
  PA[PropelAuth]
  HN[Host nginx TLS]
  WEB[web 127.0.0.1:3000]
  API[api 127.0.0.1:3001]
  PG[(PostgreSQL)]
  RD[(Redis)]
  S3[(MinIO)]

  User --> HN
  User --> PA
  HN --> WEB
  HN --> API
  WEB --> API
  API --> PG
  API --> RD
  API --> S3
  API --> PA
```

**Single-domain URLs** (recommended):

| URL | Target |
|-----|--------|
| `https://app.yourdomain.com/` | Next.js |
| `https://app.yourdomain.com/api/*` | NestJS (except `/api/auth/*` handled by Next — see nginx example) |
| `https://app.yourdomain.com/socket.io/*` | WebSocket |
| `https://app.yourdomain.com/api/auth/callback` | PropelAuth (Next.js route) |

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
| `./scripts/deploy-prod.sh initial` | First deploy on a VPS |
| `./scripts/deploy-prod.sh update` | After `git pull` / code changes (default: rebuild all, `--no-cache`) |
| `./scripts/deploy-prod.sh update --migrate` | Update + Prisma migrations |
| `./scripts/deploy-prod.sh migrate` | Migrations only |
| `./scripts/deploy-prod.sh nginx-install --domain app.yourdomain.com` | Install host nginx site file |

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
- [ ] [PropelAuth](https://www.propelauth.com) project
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

MinIO console: use SSH tunnel to port 9001 — do not expose 9000/9001 publicly in prod (`prod.yml` resets those ports).

---

## Step 4 — PropelAuth

In the PropelAuth dashboard:

1. Redirect URL: `https://app.yourdomain.com/api/auth/callback`
2. Copy auth URL → `PROPELAUTH_AUTH_URL` / `NEXT_PUBLIC_AUTH_URL`
3. API key → `PROPELAUTH_API_KEY`
4. Verifier key (single line) → `PROPELAUTH_VERIFIER_KEY` (web)

See [propelauth.md](./propelauth.md). After deploy, run [production-smoke-runbook.md](./production-smoke-runbook.md).

---

## Step 5 — `/opt/erp/.env`

Create once (never commit):

```env
# --- App secrets & public URLs (required) ---
CORS_ORIGIN=https://app.yourdomain.com
PROPELAUTH_AUTH_URL=https://YOUR_PROJECT.propelauth.com
PROPELAUTH_API_KEY=your-production-api-key
NEXT_PUBLIC_API_URL=https://app.yourdomain.com
NEXT_PUBLIC_AUTH_URL=https://YOUR_PROJECT.propelauth.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
PROPELAUTH_REDIRECT_URI=https://app.yourdomain.com/api/auth/callback
PROPELAUTH_VERIFIER_KEY=-----BEGIN PUBLIC KEY-----\n...

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

---

## Step 6–8 — Deploy application (automated)

From `/opt/erp` after `.env` is ready:

```bash
chmod +x scripts/deploy-prod.sh scripts/deploy-prod-initial.sh scripts/deploy-prod-update.sh
./scripts/deploy-prod.sh initial
```

This runs: `pnpm install` → `db:generate` → start postgres/redis/minio → build api+web → start api+web → `prisma migrate deploy` → local health check.

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

---

## Step 9 — Host nginx and TLS

1. Copy and edit the example:

   ```bash
   sudo cp /opt/erp/infra/nginx/host-nginx.conf.example /etc/nginx/sites-available/erp
   sudo sed -i 's/app.yourdomain.com/<your-domain>/g' /etc/nginx/sites-available/erp
   sudo ln -sf /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default   # if it conflicts
   ```

2. Or use the install helper (copies the example and substitutes domain from `--domain` or `.env`):

   ```bash
   ./scripts/deploy-prod.sh nginx-install --domain app.yourdomain.com
   sudo certbot --nginx -d app.yourdomain.com
   ```

   Or use Cloudflare origin certificates — adjust `ssl_certificate` paths in the site file.

4. Confirm WebSocket routes: `/socket.io/` must have `Upgrade` headers (included in the example).

Public check:

```bash
curl -s https://app.yourdomain.com/api/health
```

**Optional — nginx in Docker:** for local all-in-docker demos only, [docker-compose.nginx.yml](../infra/docker/docker-compose.nginx.yml) + [nginx.conf](../infra/nginx/nginx.conf). Not used on the production VPS.

---

## Step 10 — Smoke test (Phase 1)

Browser: `https://app.yourdomain.com`

| # | Test | Pass |
|---|------|------|
| 1 | Auth | PropelAuth login → `/dashboard` |
| 2 | Sync | First visit creates user/org |
| 3 | Settings | Branch + inventory pools |
| 4 | PMS | Guest, room, reservation, check-in/out |
| 5 | POS | Order → kitchen → pay |
| 6 | Kitchen | Ticket flow |
| 7 | Inventory | Items, movements |
| 8 | Accounting | Journals after POS |
| 9 | HR | Employee, payroll queue |
| 10 | Reports | CSV export completes |
| 11 | Realtime | PMS room updates (Socket.IO) |
| 12 | Health | `GET /api/health` → 200 |

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
| `PROPELAUTH_*` | From dashboard |
| In-container DB (Path A) | Set by compose `api.environment`, not `.env` |

Validated in `packages/config/src/env.ts`.

---

## Staging

Duplicate with `staging.yourdomain.com`, separate DB and PropelAuth project. `db:seed` on staging only.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|--------|-----|
| `Can't reach database server at localhost:5432` in **api** container | `.env` has localhost; overrides missing or api not recreated | Recreate api after pull; bundled stack uses compose `api.environment` |
| `Bind for :::6379` / `5432` | Host services conflict | Use `docker-compose.prod.yml`; `ss -tlnp` |
| `Bind for 0.0.0.0:80 failed` | Starting compose **nginx** (removed from default) | Use host nginx only; do not add `docker-compose.nginx.yml` on VPS |
| 502 from public URL | Host nginx up, api/web down | `curl 127.0.0.1:3001/api/health`; `docker compose "${COMPOSE[@]}" ps` |
| Login loop | `PROPELAUTH_REDIRECT_URI` mismatch | Match dashboard exactly |
| CORS errors | `CORS_ORIGIN` ≠ app URL | Align with `NEXT_PUBLIC_APP_URL` |
| Kitchen not updating | WebSocket blocked | Check `/socket.io/` in host nginx config |
| Old UI after `git pull` | Image not rebuilt | `./scripts/deploy-prod.sh update web` |
| `compose ps` empty, site works | Wrong cwd/project | `cd /opt/erp`; see [vps-docker-operations.md](./vps-docker-operations.md) |
| `SOURCE_REV` warning | Harmless on `ps` | Export for builds: `export SOURCE_REV=$(git rev-parse HEAD)` |

---

## Quick checklist

```
[ ] DNS → VPS
[ ] nginx + certbot installed on host
[ ] /opt/erp/.env (PropelAuth, NEXT_PUBLIC_*, CORS)
[ ] ./scripts/deploy-prod.sh initial (or manual compose up + migrate)
[ ] host-nginx.conf.example installed under /etc/nginx
[ ] certbot / TLS active
[ ] curl https://app.yourdomain.com/api/health
[ ] Phase 1 smoke tests
[ ] Backups scheduled
```

---

## Related docs

- [vps-docker-operations.md](./vps-docker-operations.md)
- [deployment.md](./deployment.md)
- [saas-launch-guide.md](./saas-launch-guide.md)

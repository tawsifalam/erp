# Hospitality ERP

Multi-tenant hospitality ERP/PMS: PMS, POS, inventory ledger, accounting, HR/payroll.

## Stack

- **Web:** Next.js + Chakra UI
- **API:** NestJS + Prisma + PostgreSQL
- **Auth:** First-party JWT + Redis refresh sessions
- **Cache/Queue:** Redis + BullMQ
- **Realtime:** Socket.IO

## Quick start

```bash
cp .env.example .env
# Set JWT secrets in .env (see docs/auth.md)
pnpm install
```

### Option A — Docker (recommended)

Your `.env` file must be at the **repo root** (`erp/.env`). Compose reads it only when the project directory is the repo root.

```bash
cp .env.example .env   # if needed — set JWT secrets
docker compose up -d postgres redis minio
docker compose build
docker compose up -d api web
pnpm db:reset
```

Use the root [docker-compose.yml](docker-compose.yml) (do **not** pass `-f infra/docker/...` alone — that makes Compose look for `.env` under `infra/docker/`).

**Production VPS:** [docs/cloud-deployment.md](docs/cloud-deployment.md) — `./scripts/deploy-prod.sh initial` then `./scripts/deploy-prod.sh update`.

Equivalent with an explicit env file:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml build
```

### Option B — Local installs (no Docker)

<details>
<summary>macOS (Homebrew)</summary>

```bash
# Postgres
brew install postgresql@16
brew services start postgresql@16
createdb hospitality_erp

# Redis
brew install redis
brew services start redis

# MinIO (optional — only needed for PDF/report file storage)
brew install minio/stable/minio
mkdir -p ~/minio/data
minio server ~/minio/data --console-address ":9001" &
```

Update `.env`:
```env
DATABASE_URL=postgresql://<your-mac-username>@localhost:5432/hospitality_erp
REDIS_URL=redis://localhost:6379
```

</details>

<details>
<summary>Linux (apt)</summary>

```bash
# Postgres
sudo apt update && sudo apt install -y postgresql
sudo -u postgres createdb hospitality_erp
sudo -u postgres psql -c "CREATE USER erp WITH PASSWORD 'erp'; GRANT ALL ON DATABASE hospitality_erp TO erp;"

# Redis
sudo apt install -y redis-server
sudo systemctl start redis-server
```

</details>

### Finish setup (both options)

```bash
pnpm db:reset      # Creates all tables + demo seed (recommended for fresh setup)
```

Use `pnpm db:migrate` only when adding new migrations after the init schema.

`pnpm db:reset` and other `db:*` commands read **`DATABASE_URL` from this file** via [`apps/api/prisma.config.ts`](apps/api/prisma.config.ts).

```bash
# Or manually:
pnpm db:migrate    # Creates all tables
pnpm db:seed       # Loads demo data (see below)
pnpm dev           # Starts API (3001) + Web (3000)
```

If you already have a database with an old migration history:

```bash
docker compose down -v   # optional: wipe Postgres volume
docker compose up -d postgres redis minio
pnpm db:reset
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- Kitchen display: http://localhost:3000/pos/kitchen

## Seed data overview

The seed creates a realistic working dataset:

| Entity | Data |
|--------|------|
| Organization | Boulevard Hospitality Group |
| Branches | Main Hotel & Restaurant, Boulevard Café |
| Rooms | 7 rooms (4 Standard @ ৳3,500, 3 Deluxe @ ৳6,000–7,500) |
| Guests | 5 guests (Rahim, Fatima, John, Maria, Chen) |
| Reservations | 5 bookings (1 checked-in, 3 confirmed, 1 inquiry) |
| Menu | 10 items across Breakfast, Mains, Beverages |
| Inventory | 12 items with initial stock (rice, chicken, eggs, etc.) |
| Recipes | 8 BOM recipes linking menu items to ingredients |
| Orders | 3 orders (1 completed, 1 in-kitchen, 1 draft) |
| Employees | 5 staff (chef, front desk, waiter, housekeeper, accountant) |
| Accounts | 14 chart-of-accounts entries |
| Journal entries | 3 sample entries (room payment, F&B sale, COGS) |

## Testing

```bash
pnpm test              # Unit tests (API Jest + web Vitest + utils Vitest)
pnpm test:e2e:install  # One-time: download Playwright Chromium
pnpm test:e2e          # E2E (Playwright; mocked API routes + seed data)
pnpm smoke:local       # Real-stack smoke (JWT login + DB; see docs/smoke-local.md)
```

Coverage checklist and remaining gaps: [test-coverage-gaps.md](docs/test-coverage-gaps.md).

E2E expects Postgres/Redis running and seed data (`pnpm db:reset`). Playwright starts `pnpm dev` from the repo root unless `CI` is set.

Local smoke (`pnpm smoke:local`) also needs Docker infra and `SMOKE_USER_EMAIL` / `SMOKE_USER_PASSWORD` in `.env` — see [smoke-local.md](docs/smoke-local.md).

## Documentation

- [Local Setup](docs/local-setup.md) — full environment configuration
- [Authentication](docs/auth.md) — JWT login, sessions, invites
- [App Workflow Guide](docs/app-workflow-guide.md) — how each module works with curl examples ([PMS](docs/app-workflow-guide.md#2-property-management-system-pms), [procurement](docs/app-workflow-guide.md#11-procurement), [integrations](docs/app-workflow-guide.md#13-integrations-channel-manager))
- [PMS Module](docs/pms-module.md) — property management (rooms, reservations, housekeeping)
- [POS Module](docs/pos-module.md) — point of sale (menu, orders, kitchen, payments)
- [Inventory Module](docs/inventory-module.md) — stock ledger, movements, recipes/BOM
- [Accounting Module](docs/accounting-module.md) — chart of accounts, journals, automated postings
- [HR Module](docs/hr-module.md) — employees, attendance, staff meals, payroll
- [Reporting Module](docs/reporting-module.md) — dashboard metrics and CSV exports
- [Settings Module](docs/settings-module.md) — organizations, branches, inventory pools
- [ERP Completeness Roadmap](docs/erp-completeness-roadmap.md) — path from Phase 1 to full hospitality ERP
- [SaaS Launch Guide](docs/saas-launch-guide.md) — monetization, billing design, and launch checklists
- [Organization Onboarding](docs/organization-onboarding.md) — create/join org, roles, join approval
- [Tenant Model](docs/tenant-model.md) — multi-tenancy architecture
- [Deployment](docs/deployment.md) — production deployment summary
- [Cloud Deployment Guide](docs/cloud-deployment.md) — step-by-step cloud deploy for Phase 1
- [Production Smoke Runbook](docs/production-smoke-runbook.md) — go-live checklist after deploy
- [Local Smoke Tests](docs/smoke-local.md) — automated real-stack smoke on localhost

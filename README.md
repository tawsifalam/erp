# Hospitality ERP

Multi-tenant hospitality ERP/PMS: PMS, POS, inventory ledger, accounting, HR/payroll.

## Stack

- **Web:** Next.js + Chakra UI
- **API:** NestJS + Prisma + PostgreSQL
- **Auth:** PropelAuth
- **Cache/Queue:** Redis + BullMQ
- **Realtime:** Socket.IO

## Quick start

```bash
cp .env.example .env
# Configure PropelAuth credentials in .env (see docs/propelauth.md)
pnpm install
```

### Option A — Docker (recommended)

Starts Postgres, Redis, and MinIO with one command:

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres redis minio
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
pnpm db:migrate    # Creates all tables
pnpm db:seed       # Loads demo data (see below)
pnpm dev           # Starts API (3001) + Web (3000)
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
pnpm test                        # API unit tests (Jest)
pnpm --filter @erp/web test:unit # Web unit tests (Vitest)
pnpm --filter @erp/web test:e2e  # E2E tests (Playwright)
```

## Documentation

- [Local Setup](docs/local-setup.md) — full environment configuration
- [PropelAuth](docs/propelauth.md) — authentication integration
- [App Workflow Guide](docs/app-workflow-guide.md) — how each module works with examples ([§1b org & branch management](docs/app-workflow-guide.md#1b-organization--branch-management))
- [PMS Module](docs/pms-module.md) — property management (rooms, reservations, housekeeping)
- [POS Module](docs/pos-module.md) — point of sale (menu, orders, kitchen, payments)
- [Inventory Module](docs/inventory-module.md) — stock ledger, movements, recipes/BOM
- [Accounting Module](docs/accounting-module.md) — chart of accounts, journals, automated postings
- [HR Module](docs/hr-module.md) — employees, attendance, staff meals, payroll
- [Tenant Model](docs/tenant-model.md) — multi-tenancy architecture and Settings API surface
- [Deployment](docs/deployment.md) — production deployment

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
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

See [docs/local-setup.md](docs/local-setup.md) and [docs/propelauth.md](docs/propelauth.md) for full setup.

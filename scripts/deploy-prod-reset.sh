#!/usr/bin/env bash
# Destructive production reset: wipe ERP data and reapply schema.
#
# Default: remove Postgres/Redis/MinIO volumes, migrate deploy (empty DB, no demo seed).
#
# Usage:
#   ./scripts/deploy-prod-reset.sh              # confirm, wipe volumes, empty schema
#   ./scripts/deploy-prod-reset.sh --yes        # skip confirmation
#   ./scripts/deploy-prod-reset.sh --db-only    # Postgres reset only (keep redis/minio)
#   ./scripts/deploy-prod-reset.sh --seed       # load demo seed (staging only)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/compose-prod.sh
source "${SCRIPT_DIR}/lib/compose-prod.sh"

WIPE_VOLUMES=1
WITH_SEED=0
ASSUME_YES=0

usage() {
  cat <<'EOF'
Wipe production ERP data and reapply database schema.

  --yes, -y       Skip confirmation prompt (automation / CI)
  --db-only       Reset PostgreSQL via prisma migrate reset; keep Redis/MinIO volumes
  --seed          Run demo seed after reset (staging only — not for real production)

Default (no flags):
  docker compose down -v  →  fresh Postgres/Redis/MinIO  →  prisma migrate deploy

PropelAuth users are NOT deleted. After reset, sign in and create/join an organization.

Examples:
  ./scripts/deploy-prod.sh reset
  ./scripts/deploy-prod-reset.sh --yes
  ./scripts/deploy-prod-reset.sh --db-only --seed
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) ASSUME_YES=1; shift ;;
    --db-only) WIPE_VOLUMES=0; shift ;;
    --seed) WITH_SEED=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

erp_require_cmds docker curl
erp_compose_init
erp_cd_root

if [[ "${ASSUME_YES}" -eq 0 ]]; then
  echo "WARNING: This permanently deletes ERP data on this server."
  if [[ "${WIPE_VOLUMES}" -eq 1 ]]; then
    echo "  - PostgreSQL, Redis, and MinIO Docker volumes will be removed."
  else
    echo "  - PostgreSQL will be dropped and recreated (Redis/MinIO volumes kept)."
  fi
  if [[ "${WITH_SEED}" -eq 1 ]]; then
    echo "  - Demo seed data will be loaded afterward."
  else
    echo "  - No demo seed (empty schema)."
  fi
  echo "  - PropelAuth accounts are unchanged."
  printf "Type RESET to continue: "
  read -r confirm
  if [[ "${confirm}" != "RESET" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

if [[ "${WIPE_VOLUMES}" -eq 1 ]]; then
  echo "==> stopping stack and removing data volumes"
  erp_compose down -v --remove-orphans
  erp_ensure_data
  erp_up_apps ""
  erp_migrate
  if [[ "${WITH_SEED}" -eq 1 ]]; then
    erp_db_seed
  fi
else
  echo "==> stopping api and web"
  erp_compose stop api web
  erp_ensure_data
  erp_migrate_reset 1
  erp_up_apps ""
  if [[ "${WITH_SEED}" -eq 1 ]]; then
    erp_db_seed
  fi
fi

erp_health_local 90
erp_compose ps

echo "==> clean reset complete"
if [[ "${WITH_SEED}" -eq 0 ]]; then
  echo "    Sign in and create an organization (onboarding or Settings)."
fi

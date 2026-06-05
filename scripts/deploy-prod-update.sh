#!/usr/bin/env bash
# Deploy code changes: pull, rebuild images, recreate containers.
# Usage: ./scripts/deploy-prod-update.sh [all|api|web] [--migrate] [--no-pull] [--use-cache]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/compose-prod.sh
source "${SCRIPT_DIR}/lib/compose-prod.sh"

TARGET="all"
DO_PULL=1
RUN_MIGRATE=0
NO_CACHE=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    all|api|web) TARGET="$1"; shift ;;
    --migrate) RUN_MIGRATE=1; shift ;;
    --no-pull) DO_PULL=0; shift ;;
    --use-cache) NO_CACHE=0; shift ;;
    -h|--help)
      cat <<EOF
Usage: $0 [all|api|web] [--migrate] [--no-pull] [--use-cache]

  all|api|web   Services to rebuild (default: all)
  --migrate     Run prisma migrate deploy after api is up
  --no-pull     Skip git pull
  --use-cache   Allow Docker layer cache (default: --no-cache)
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

erp_require_cmds docker git curl
erp_compose_init
erp_cd_root

if [[ "${DO_PULL}" -eq 1 ]]; then
  erp_git_pull
fi

erp_export_source_rev

# Keep data services up (and minio healthy) before api restarts — avoids "File storage is unavailable"
if [[ "${TARGET}" == "all" || "${TARGET}" == "api" ]]; then
  erp_ensure_data
fi

erp_rebuild_target "${TARGET}" "${NO_CACHE}"

if [[ "${RUN_MIGRATE}" -eq 1 ]]; then
  erp_migrate
fi

if [[ "${TARGET}" == "all" || "${TARGET}" == "api" ]]; then
  erp_health_local 90
fi

erp_compose ps
echo "==> update deploy complete (${TARGET})"

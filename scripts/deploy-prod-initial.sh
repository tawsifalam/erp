#!/usr/bin/env bash
# First-time production deploy (bundled postgres/redis/minio + host nginx layout).
# Prereqs: Docker, pnpm, /opt/erp/.env, DNS, host nginx packages optional until TLS step.
#
# Usage: ./scripts/deploy-prod-initial.sh [--no-pull] [--skip-migrate]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/compose-prod.sh
source "${SCRIPT_DIR}/lib/compose-prod.sh"

DO_PULL=1
SKIP_MIGRATE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-pull) DO_PULL=0; shift ;;
    --skip-migrate) SKIP_MIGRATE=1; shift ;;
    -h|--help)
      echo "Usage: $0 [--no-pull] [--skip-migrate]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

erp_require_cmds docker git pnpm curl
erp_compose_init
erp_cd_root

erp_require_env_keys \
  NEXT_PUBLIC_API_URL \
  NEXT_PUBLIC_APP_URL \
  NEXT_PUBLIC_AUTH_URL \
  PROPELAUTH_API_KEY \
  CORS_ORIGIN

if [[ "${DO_PULL}" -eq 1 ]]; then
  erp_git_pull
fi

echo "==> pnpm install + prisma client"
pnpm install
pnpm db:generate

erp_export_source_rev
erp_up_data

echo "==> build api + web (cached layers allowed on first deploy)"
erp_build_apps ""

erp_up_apps ""
if [[ "${SKIP_MIGRATE}" -eq 0 ]]; then
  erp_migrate
fi

erp_health_local 90

erp_compose ps

domain="$(erp_env_value NEXT_PUBLIC_APP_URL)"
domain="${domain#https://}"
domain="${domain#http://}"
domain="${domain%%/*}"
erp_print_nginx_hint "${domain}"

echo "==> initial deploy complete"
echo "    update later: ./scripts/deploy-prod.sh update"

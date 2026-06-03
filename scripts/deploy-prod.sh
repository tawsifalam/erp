#!/usr/bin/env bash
# Production deploy CLI (host nginx + Docker api/web/data).
#
#   ./scripts/deploy-prod.sh initial              # first deploy
#   ./scripts/deploy-prod.sh update [all|api|web] [--migrate]
#   ./scripts/deploy-prod.sh migrate              # schema only
#   ./scripts/deploy-prod.sh status|logs|health
#   ./scripts/deploy-prod.sh nginx-install --domain app.example.com
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_DIR="${ROOT}/scripts"

usage() {
  cat <<'EOF'
Production deployment (run from repo root, e.g. /opt/erp)

  initial [--no-pull] [--skip-migrate]
      Start data services, build api+web, migrate, health check.
      Install host nginx separately (nginx-install or certbot).

  update [all|api|web] [--migrate] [--no-pull] [--use-cache]
      git pull, rebuild images (--no-cache by default), recreate containers.

  migrate
      prisma migrate deploy in the running api container.

  status          docker compose ps
  logs [service]  follow logs (default: api web)
  health          curl 127.0.0.1:3001/api/health

  nginx-install [--domain NAME]
      Copy host-nginx.conf.example to /etc/nginx (requires sudo).

Examples:
  ./scripts/deploy-prod.sh initial
  ./scripts/deploy-prod.sh update --migrate
  ./scripts/deploy-prod.sh update web
  ./scripts/deploy-prod.sh nginx-install --domain app.yourdomain.com
EOF
}

cmd="${1:-}"
shift || true

case "${cmd}" in
  initial)
    exec "${SCRIPT_DIR}/deploy-prod-initial.sh" "$@"
    ;;
  update)
    exec "${SCRIPT_DIR}/deploy-prod-update.sh" "$@"
    ;;
  migrate)
    # shellcheck source=lib/compose-prod.sh
    source "${SCRIPT_DIR}/lib/compose-prod.sh"
    erp_require_cmds docker
    erp_compose_init
    erp_cd_root
    erp_migrate
    ;;
  status)
    # shellcheck source=lib/compose-prod.sh
    source "${SCRIPT_DIR}/lib/compose-prod.sh"
    erp_compose_init
    erp_cd_root
    erp_compose ps -a
    ;;
  logs)
    # shellcheck source=lib/compose-prod.sh
    source "${SCRIPT_DIR}/lib/compose-prod.sh"
    erp_compose_init
    erp_cd_root
    if [[ $# -gt 0 ]]; then
      erp_compose logs -f "$@"
    else
      erp_compose logs -f api web
    fi
    ;;
  health)
    # shellcheck source=lib/compose-prod.sh
    source "${SCRIPT_DIR}/lib/compose-prod.sh"
    erp_require_cmds curl
    erp_compose_init
    erp_health_local 15
    ;;
  nginx-install)
    domain=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --domain) domain="$2"; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
      esac
    done
    # shellcheck source=lib/compose-prod.sh
    source "${SCRIPT_DIR}/lib/compose-prod.sh"
    erp_require_cmds sudo
    erp_compose_init
    erp_nginx_install "${domain}"
    ;;
  help|-h|--help|"")
    usage
    ;;
  *)
    echo "Unknown command: ${cmd}" >&2
    usage >&2
    exit 1
    ;;
esac

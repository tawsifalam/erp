# Shared production Compose helpers. Source from deploy scripts:
#   source "$(dirname "$0")/lib/compose-prod.sh"
# Do not execute this file directly.

erp_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ERP_ROOT="$(cd "${erp_lib_dir}/../.." && pwd)"

# Populated by erp_compose_init
COMPOSE=()

erp_compose_init() {
  local env_file="${ERP_ROOT}/.env"
  if [[ ! -f "${env_file}" ]]; then
    echo "error: missing ${env_file} — copy from .env.example and set production values" >&2
    exit 1
  fi

  local -a files=(
    "${ERP_ROOT}/docker-compose.yml"
    "${ERP_ROOT}/infra/docker/docker-compose.prod.yml"
    "${ERP_ROOT}/infra/docker/docker-compose.prod-host-nginx.yml"
  )
  local f
  for f in "${files[@]}"; do
    if [[ ! -f "${f}" ]]; then
      echo "error: missing compose file ${f}" >&2
      exit 1
    fi
  done

  COMPOSE=(
    --env-file "${env_file}"
    -f "${ERP_ROOT}/docker-compose.yml"
    -f "${ERP_ROOT}/infra/docker/docker-compose.prod.yml"
    -f "${ERP_ROOT}/infra/docker/docker-compose.prod-host-nginx.yml"
  )
}

erp_cd_root() {
  cd "${ERP_ROOT}"
}

erp_require_cmds() {
  local cmd
  for cmd in "$@"; do
    if ! command -v "${cmd}" >/dev/null 2>&1; then
      echo "error: required command not found: ${cmd}" >&2
      exit 1
    fi
  done
}

erp_env_value() {
  local key="$1"
  grep -E "^[[:space:]]*${key}=" "${ERP_ROOT}/.env" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '\r'
}

erp_require_env_keys() {
  local key val
  for key in "$@"; do
    val="$(erp_env_value "${key}")"
    if [[ -z "${val}" ]]; then
      echo "error: ${key} is missing or empty in ${ERP_ROOT}/.env" >&2
      exit 1
    fi
  done
}

erp_export_source_rev() {
  export SOURCE_REV
  SOURCE_REV="$(git -C "${ERP_ROOT}" rev-parse HEAD)"
  echo "==> SOURCE_REV=${SOURCE_REV} ($(git -C "${ERP_ROOT}" log -1 --oneline))"
}

erp_compose() {
  docker compose "${COMPOSE[@]}" "$@"
}

erp_git_pull() {
  echo "==> git pull"
  git -C "${ERP_ROOT}" pull
}

erp_wait_healthy() {
  local service="$1"
  local max_wait="${2:-90}"
  local elapsed=0
  echo "==> waiting for ${service} to be healthy (max ${max_wait}s)"
  while (( elapsed < max_wait )); do
    local status
    status="$(erp_compose ps --status running --format '{{.Service}} {{.Health}}' 2>/dev/null | awk -v s="${service}" '$1==s {print $2; exit}')"
    if [[ "${status}" == "healthy" ]]; then
      echo "==> ${service} is healthy"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "error: ${service} did not become healthy in ${max_wait}s" >&2
  erp_compose ps >&2 || true
  return 1
}

erp_ensure_data() {
  echo "==> ensuring postgres redis minio are running"
  erp_compose up -d postgres redis minio
  erp_wait_healthy postgres
  erp_wait_healthy redis
  erp_wait_healthy minio
}

# Backward-compatible alias
erp_up_data() {
  erp_ensure_data
}

erp_migrate() {
  echo "==> prisma migrate deploy"
  # API image stores Prisma at /app/apps/api/prisma (WORKDIR). Use an absolute schema
  # path so migrate works regardless of exec cwd (repo-relative paths break in-container).
  erp_compose exec -T api npx prisma migrate deploy --schema=/app/apps/api/prisma/schema.prisma
}

erp_build_apps() {
  local no_cache="${1:-}"
  local -a services=(api web)
  if [[ -n "${no_cache}" ]]; then
    erp_compose build --pull=false --no-cache "${services[@]}"
  else
    erp_compose build --pull=false "${services[@]}"
  fi
}

erp_up_apps() {
  local recreate="${1:-}"
  if [[ -n "${recreate}" ]]; then
    erp_compose up -d --force-recreate api web
  else
    erp_compose up -d api web
  fi
}

erp_rebuild_target() {
  local target="$1"
  local no_cache="${2:-1}"
  local -a build_flags=(--pull=false)
  if [[ -n "${no_cache}" ]]; then
    build_flags+=(--no-cache)
  fi

  case "${target}" in
    api)
      erp_compose build "${build_flags[@]}" api
      erp_compose up -d --force-recreate --no-deps api
      ;;
    web)
      erp_compose build "${build_flags[@]}" web
      erp_compose up -d --force-recreate --no-deps web
      ;;
    all)
      erp_compose build "${build_flags[@]}" api web
      erp_compose up -d --force-recreate api web
      ;;
    *)
      echo "error: unknown build target: ${target} (use api, web, or all)" >&2
      return 1
      ;;
  esac
}

erp_health_local() {
  local url="http://127.0.0.1:3001/api/health"
  local max_wait="${1:-60}"
  local elapsed=0
  echo "==> checking ${url}"
  while (( elapsed < max_wait )); do
    if curl -sf "${url}" | grep -q '"status":"ok"'; then
      echo "==> API health OK"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "error: API health check failed" >&2
  erp_compose logs --tail=30 api >&2 || true
  return 1
}

erp_print_nginx_hint() {
  local domain="${1:-}"
  cat <<EOF

==> Host nginx (manual once per server)
  1. sudo cp ${ERP_ROOT}/infra/nginx/host-nginx.conf.example /etc/nginx/sites-available/erp
  2. Set server_name / SSL paths (or run certbot after a minimal HTTP server block)
EOF
  if [[ -n "${domain}" ]]; then
    echo "  3. sudo sed -i 's/app.yourdomain.com/${domain}/g' /etc/nginx/sites-available/erp"
    echo "  4. sudo certbot --nginx -d ${domain}"
  fi
  cat <<EOF
  5. sudo ln -sf /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/
  6. sudo nginx -t && sudo systemctl reload nginx

Or: ./scripts/deploy-prod.sh nginx-install --domain <your-domain>
Public check: curl -s https://<domain>/api/health

EOF
}

erp_nginx_install() {
  local domain="${1:-}"
  if [[ -z "${domain}" ]]; then
    domain="$(erp_env_value NEXT_PUBLIC_APP_URL)"
    domain="${domain#https://}"
    domain="${domain#http://}"
    domain="${domain%%/*}"
  fi
  if [[ -z "${domain}" ]]; then
    echo "error: pass --domain or set NEXT_PUBLIC_APP_URL in .env" >&2
    exit 1
  fi

  local src="${ERP_ROOT}/infra/nginx/host-nginx.conf.example"
  local dest="/etc/nginx/sites-available/erp"
  echo "==> installing host nginx site for ${domain}"
  sudo cp "${src}" "${dest}"
  sudo sed -i "s/app.yourdomain.com/${domain}/g" "${dest}"
  sudo ln -sf "${dest}" /etc/nginx/sites-enabled/erp
  sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  sudo nginx -t
  sudo systemctl reload nginx
  echo "==> nginx config installed. Run: sudo certbot --nginx -d ${domain}"
}

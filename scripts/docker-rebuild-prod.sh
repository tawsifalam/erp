#!/usr/bin/env bash
# Rebuild api/web images from /opt/erp source and recreate containers.
# Usage: ./scripts/docker-rebuild-prod.sh [api|web|all]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(
  -f "$ROOT/infra/docker/docker-compose.yml"
  -f "$ROOT/infra/docker/docker-compose.prod.yml"
)
if [[ -f "$ROOT/infra/docker/docker-compose.prod-host-nginx.yml" ]]; then
  COMPOSE+=(-f "$ROOT/infra/docker/docker-compose.prod-host-nginx.yml")
fi

TARGET="${1:-all}"

echo "==> git pull"
git pull
SOURCE_REV="$(git rev-parse HEAD)"
echo "==> building commit ${SOURCE_REV} ($(git log -1 --oneline))"

export SOURCE_REV
# Compose loads .env from project directory ($ROOT) for NEXT_PUBLIC_* build args — do not `source .env` (PEM keys break shell).

case "$TARGET" in
  api)
    docker compose "${COMPOSE[@]}" build --pull=false --no-cache api
    docker compose "${COMPOSE[@]}" up -d --force-recreate --no-deps api
    ;;
  web)
    docker compose "${COMPOSE[@]}" build --pull=false --no-cache web
    docker compose "${COMPOSE[@]}" up -d --force-recreate --no-deps web
    ;;
  all)
    docker compose "${COMPOSE[@]}" build --pull=false --no-cache api web
    docker compose "${COMPOSE[@]}" up -d --force-recreate api web
    ;;
  *)
    echo "Usage: $0 [api|web|all]" >&2
    exit 1
    ;;
esac

echo "==> verify SOURCE_REV inside containers"
docker compose "${COMPOSE[@]}" logs --tail=5 api 2>/dev/null || true
docker compose "${COMPOSE[@]}" exec web sh -c 'grep -r "No integrations yet" /app/apps/web/.next/server 2>/dev/null | head -1 || echo "web: search path may differ; check Settings → Integrations UI"' || true

echo "==> done"

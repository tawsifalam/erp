#!/usr/bin/env bash
# Backward-compatible alias for deploy-prod update.
# Usage: ./scripts/docker-rebuild-prod.sh [api|web|all] [--migrate]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-all}"
shift || true

EXTRA=()
if [[ "${TARGET}" == "--migrate" ]]; then
  EXTRA+=(--migrate)
  TARGET="all"
fi

case "${TARGET}" in
  api|web|all) ;;
  -h|--help)
    exec "${ROOT}/scripts/deploy-prod.sh" help
    ;;
  *)
    echo "Usage: $0 [api|web|all] [--migrate]" >&2
    echo "Prefer: ./scripts/deploy-prod.sh update [all|api|web] [--migrate]" >&2
    exit 1
    ;;
esac

for arg in "$@"; do
  if [[ "${arg}" == "--migrate" ]]; then
    EXTRA+=(--migrate)
  fi
done

echo "note: docker-rebuild-prod.sh → deploy-prod.sh update ${TARGET}"
exec "${ROOT}/scripts/deploy-prod.sh" update "${TARGET}" "${EXTRA[@]}"

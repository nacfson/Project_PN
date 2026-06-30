#!/usr/bin/env bash
set -euo pipefail

# Local dev-only guest seed.
# This script is intentionally separate from migrations and is invoked only by
# scripts/start-web-dev.sh. It must not be called in production or staging.

if [[ "${PN_ENV:-}" != "local" && "${APP_ENV:-}" != "local" ]]; then
  echo "FATAL: seed-dev-guest.sh can only run with PN_ENV=local or APP_ENV=local" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: must be run from inside the Project PN git repo" >&2
  exit 1
}
cd "$REPO_ROOT"

# Extra guard: refuse to run if a deployment environment is explicitly set.
DEPLOY_ENV="${DEPLOY_ENV:-}${ENV:-}"
if [[ "$DEPLOY_ENV" =~ (production|staging|prod|deploy) ]]; then
  echo "ERROR: refusing to seed guest account in DEPLOY_ENV/ENV=$DEPLOY_ENV" >&2
  exit 1
fi

if [[ ! -f backend/.env ]]; then
  echo "backend/.env not found; copying from backend/.env.example"
  cp backend/.env.example backend/.env
fi

# Load DATABASE_URL from backend/.env.
set -a
# shellcheck source=backend/.env
source backend/.env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set in backend/.env" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is required but not installed" >&2
  exit 1
fi

echo "[seed-dev-guest] ensuring local guest account is verified and session is present"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/seed-dev-guest.sql

echo "[seed-dev-guest] done"

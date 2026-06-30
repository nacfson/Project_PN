#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/start-web-dev.sh [options]

Starts the full local web dev stack for Project PN:
  1. PostgreSQL (via backend/docker compose up -d)
  2. Backend migrations (go run ./cmd/migrate up)
  3. Backend API (go run ./cmd/api)
  4. Expo web dev server (npm run web)

The API runs in the background and is shut down when the web dev server exits.

Options:
  --skip-db       Skip starting Docker Compose Postgres and health check.
  --skip-migrate  Skip running backend migrations.
  -h, --help      Show this help message.

Examples:
  scripts/start-web-dev.sh
  scripts/start-web-dev.sh --skip-db
  scripts/start-web-dev.sh --skip-db --skip-migrate
USAGE
}

log() {
  printf '[web-dev] %s\n' "$*"
}

die() {
  printf '[web-dev] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "must be run from inside the Project PN git repo"
cd "$REPO_ROOT"

export PN_ENV=local

SKIP_DB=false
SKIP_MIGRATE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-db)
      SKIP_DB=true
      shift
      ;;
    --skip-migrate)
      SKIP_MIGRATE=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1 (use --help for usage)"
      ;;
  esac
done

require_cmd curl
require_cmd docker
require_cmd git
require_cmd go
require_cmd npm

if [[ ! -f backend/.env ]]; then
  log "backend/.env not found; copying from backend/.env.example"
  cp backend/.env.example backend/.env
fi

if [[ ! -f frontend/.env ]]; then
  log "frontend/.env not found; copying from frontend/.env.example"
  cp frontend/.env.example frontend/.env
fi

API_PID=""
cleanup() {
  if [[ -n "$API_PID" ]]; then
    log "stopping backend API (pid $API_PID)"
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [[ "$SKIP_DB" != true ]]; then
  log "starting PostgreSQL"
  docker compose -f backend/compose.yaml up -d

  log "waiting for PostgreSQL to be healthy"
  for i in $(seq 1 60); do
    if docker compose -f backend/compose.yaml ps postgres | grep -q healthy; then
      log "PostgreSQL is healthy"
      break
    fi
    if [[ "$i" -eq 60 ]]; then
      die "PostgreSQL did not become healthy in time"
    fi
    sleep 1
  done
else
  log "skipping PostgreSQL start (--skip-db)"
fi

if [[ "$SKIP_MIGRATE" != true ]]; then
  log "running backend migrations"
  (
    cd backend
    go run ./cmd/migrate up
  )
else
  log "skipping migrations (--skip-migrate)"
fi

log "seeding local dev guest account"
./scripts/seed-dev-guest.sh

log "starting backend API"
(cd backend && exec go run ./cmd/api) &
API_PID=$!

log "waiting for backend API to be ready"
for i in $(seq 1 60); do
  if curl -fsS http://localhost:8080/readyz >/dev/null 2>&1; then
    log "backend API is ready"
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    die "backend API did not become ready in time"
  fi
  sleep 1
done

log "starting Expo web dev server"
(
  cd frontend
  npm run web
)

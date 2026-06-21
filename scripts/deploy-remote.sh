#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  DEPLOY_HOST=user@server-ip scripts/deploy-remote.sh
  scripts/deploy-remote.sh              # if deploy/.deploy.env exists

Optional environment variables:
  DEPLOY_ENV_FILE=deploy/.deploy.env
  DEPLOY_PUBLIC_URL=http://server-ip-or-domain
  DEPLOY_ACCESS_SCOPE=private|public
  EXISTING_POSTGRES_PASSWORD=<old-password>
  REMOTE_DIR=~/project-pn/deploy
  IMAGE_NAME=project-pn-backend
  IMAGE_TAG=<git-short-sha>
  PLATFORM=linux/amd64

The script builds the backend image locally, uploads it over SSH/SCP,
loads it on the remote server, and runs Docker Compose there.
USAGE
}

log() {
  printf '[deploy] %s\n' "$*"
}

quote_remote() {
  printf "%s" "$1" | sed "s/'/'\\\\''/g; s/^/'/; s/$/'/"
}

die() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

safe_remote_path() {
  case "$1" in
    *[!A-Za-z0-9_./~:-]*)
      die "REMOTE_DIR contains unsupported characters: $1"
      ;;
  esac
}

url_host() {
  local url="$1"
  url="${url#*://}"
  url="${url%%/*}"
  url="${url%%:*}"
  printf '%s' "$url"
}

is_private_or_local_host() {
  local host="$1"
  case "$host" in
    localhost|127.*|10.*|192.168.*|0.0.0.0)
      return 0
      ;;
    172.*)
      local second_octet
      second_octet="$(printf '%s' "$host" | cut -d. -f2)"
      if [[ "$second_octet" =~ ^[0-9]+$ ]] && (( second_octet >= 16 && second_octet <= 31 )); then
        return 0
      fi
      ;;
    *.local|*.localhost)
      return 0
      ;;
  esac
  return 1
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-deploy/.deploy.env}"
if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  log "loading ${DEPLOY_ENV_FILE}"
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
fi

DEPLOY_HOST="${DEPLOY_HOST:-}"
REMOTE_DIR="${REMOTE_DIR:-~/project-pn/deploy}"
IMAGE_NAME="${IMAGE_NAME:-project-pn-backend}"
PLATFORM="${PLATFORM:-linux/amd64}"
DEPLOY_ACCESS_SCOPE="${DEPLOY_ACCESS_SCOPE:-private}"

[[ -n "$DEPLOY_HOST" ]] || die "DEPLOY_HOST is required, for example DEPLOY_HOST=user@server-ip"
safe_remote_path "$REMOTE_DIR"
case "$DEPLOY_ACCESS_SCOPE" in
  private|public) ;;
  *) die "DEPLOY_ACCESS_SCOPE must be 'private' or 'public'" ;;
esac
if [[ "$DEPLOY_ACCESS_SCOPE" == "public" ]]; then
  [[ -n "${DEPLOY_PUBLIC_URL:-}" ]] || die "DEPLOY_ACCESS_SCOPE=public requires DEPLOY_PUBLIC_URL"
  PUBLIC_HOST="$(url_host "$DEPLOY_PUBLIC_URL")"
  if is_private_or_local_host "$PUBLIC_HOST"; then
    die "DEPLOY_ACCESS_SCOPE=public requires DEPLOY_PUBLIC_URL to be a publicly reachable domain or IP, got ${DEPLOY_PUBLIC_URL}"
  fi
fi

require_cmd docker
require_cmd git
require_cmd gzip
require_cmd openssl
require_cmd scp
require_cmd ssh
require_cmd npm

IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
IMAGE_REF="${IMAGE_NAME}:${IMAGE_TAG}"
LATEST_REF="${IMAGE_NAME}:latest"
TARBALL="${TMPDIR:-/tmp}/${IMAGE_NAME}-${IMAGE_TAG}.tar.gz"
REMOTE_TARBALL="/tmp/${IMAGE_NAME}-${IMAGE_TAG}.tar.gz"
GENERATED_ENV=""

cleanup() {
  rm -f "$TARBALL"
  if [[ -n "$GENERATED_ENV" ]]; then
    rm -f "$GENERATED_ENV"
  fi
}
trap cleanup EXIT

log "building ${IMAGE_REF} for ${PLATFORM}"
docker build --platform "$PLATFORM" -t "$IMAGE_REF" -f backend/Dockerfile backend

SAVE_REFS=("$IMAGE_REF")
if [[ "$IMAGE_REF" != "$LATEST_REF" ]]; then
  log "tagging ${LATEST_REF}"
  docker tag "$IMAGE_REF" "$LATEST_REF"
  SAVE_REFS+=("$LATEST_REF")
fi

log "saving image to ${TARBALL}"
docker save "${SAVE_REFS[@]}" | gzip > "$TARBALL"

log "building frontend web bundle"
(
  cd frontend
  npm install
  # Empty EXPO_PUBLIC_API_BASE_URL lets the web app resolve API calls from
  # window.location.origin, which works for both intranet and public IPs when
  # the bundle is served by nginx on the same origin.
  EXPO_PUBLIC_API_BASE_URL= npm run web:export
)

log "creating remote deploy directories on ${DEPLOY_HOST}:${REMOTE_DIR}"
ssh "$DEPLOY_HOST" "mkdir -p ${REMOTE_DIR}/nginx ${REMOTE_DIR}/certs ${REMOTE_DIR}/web"

log "uploading compose files, web bundle, and image"
scp deploy/compose.yaml "$DEPLOY_HOST:${REMOTE_DIR}/compose.yaml"
scp deploy/.env.example "$DEPLOY_HOST:${REMOTE_DIR}/.env.example"
scp deploy/nginx/nginx.conf "$DEPLOY_HOST:${REMOTE_DIR}/nginx/nginx.conf"
scp -r frontend/dist/. "$DEPLOY_HOST:${REMOTE_DIR}/web/"
scp "$TARBALL" "$DEPLOY_HOST:${REMOTE_TARBALL}"

log "loading image on remote server"
ssh "$DEPLOY_HOST" "docker load -i ${REMOTE_TARBALL} && rm -f ${REMOTE_TARBALL}"

log "checking remote .env"
if ! ssh "$DEPLOY_HOST" "test -f ${REMOTE_DIR}/.env"; then
  log "remote .env is missing; generating staging .env"
  POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  if [[ -z "${DEPLOY_PUBLIC_URL:-}" ]]; then
    REMOTE_IP="$(ssh "$DEPLOY_HOST" "set -- \$(hostname -I 2>/dev/null); printf '%s' \"\$1\"" || true)"
    if [[ -n "$REMOTE_IP" ]]; then
      DEPLOY_PUBLIC_URL="http://${REMOTE_IP}"
    else
      DEPLOY_PUBLIC_URL="http://${DEPLOY_HOST}"
    fi
  fi

  ALL_REMOTE_IPS="$(ssh "$DEPLOY_HOST" "hostname -I 2>/dev/null || true")"
  LAN_ORIGINS=""
  for ip in ${ALL_REMOTE_IPS:-}; do
    if [[ -n "$ip" ]]; then
      LAN_ORIGINS="${LAN_ORIGINS},http://${ip}:53412"
    fi
  done

  PUBLIC_HOST="$(url_host "$DEPLOY_PUBLIC_URL")"
  if [[ "$DEPLOY_ACCESS_SCOPE" == "private" ]] && is_private_or_local_host "$PUBLIC_HOST"; then
    log "DEPLOY_PUBLIC_URL=${DEPLOY_PUBLIC_URL} is private/local; it will not work outside the intranet"
  fi

  GENERATED_ENV="${TMPDIR:-/tmp}/project-pn-deploy-${IMAGE_TAG}.env"
  cat > "$GENERATED_ENV" <<EOF
# Generated by scripts/deploy-remote.sh.
# Edit this file on the server for production values.

BACKEND_IMAGE=project-pn-backend:latest

POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgres://project_pn:${POSTGRES_PASSWORD}@postgres:5432/project_pn?sslmode=disable

ALLOWED_ORIGINS=${DEPLOY_PUBLIC_URL},http://localhost:8081,tauri://localhost,http://tauri.localhost${LAN_ORIGINS}

ENRICH_BASE_URL=
ENRICH_API_KEY=
ENRICH_MODEL=

DEFAULT_TARGET_LANG=en
DEFAULT_DEFINITION_LANG=ko

ALLOWED_TARGET_LANGS=
ALLOWED_DEFINITION_LANGS=
FORCE_TARGET_LANG=
FORCE_DEFINITION_LANG=

EMAIL_PROVIDER=log
REQUIRE_EMAIL_VERIFIED=false
SESSION_TTL=720h
MAGIC_LINK_TTL=15m
EXCHANGE_CODE_TTL=5m
APP_PUBLIC_URL=${DEPLOY_PUBLIC_URL}

RESEND_API_KEY=
EMAIL_FROM=auth@example.com

GOOGLE_CLIENT_IDS=
EOF
  scp "$GENERATED_ENV" "$DEPLOY_HOST:${REMOTE_DIR}/.env"
  ssh "$DEPLOY_HOST" "chmod 600 ${REMOTE_DIR}/.env"
  log "created remote .env with APP_PUBLIC_URL=${DEPLOY_PUBLIC_URL}"
fi

if [[ -n "${EXISTING_POSTGRES_PASSWORD:-}" ]]; then
  OLD_DB_PASSWORD="$(quote_remote "$EXISTING_POSTGRES_PASSWORD")"
  log "syncing existing Postgres user password with remote .env"
  ssh "$DEPLOY_HOST" "cd ${REMOTE_DIR} && docker compose --env-file .env up -d postgres"
  ssh "$DEPLOY_HOST" "cd ${REMOTE_DIR} && for i in \$(seq 1 30); do status=\$(docker inspect -f '{{.State.Health.Status}}' project_pn_staging-postgres-1 2>/dev/null || true); if [ \"\$status\" = healthy ]; then exit 0; fi; sleep 2; done; echo 'postgres did not become healthy' >&2; exit 1"
  ssh "$DEPLOY_HOST" "cd ${REMOTE_DIR} && set -a && . ./.env && set +a && docker exec -e PGPASSWORD=${OLD_DB_PASSWORD} project_pn_staging-postgres-1 psql -v ON_ERROR_STOP=1 -U project_pn -d project_pn -c \"alter user project_pn with password '\$POSTGRES_PASSWORD';\""
fi

if [[ "${DEPLOY_PUBLIC_URL:-}" == https://* ]] && ! ssh "$DEPLOY_HOST" "test -f ${REMOTE_DIR}/certs/fullchain.pem && test -f ${REMOTE_DIR}/certs/privkey.pem"; then
  die "TLS certs are required for HTTPS. Create ${REMOTE_DIR}/certs/fullchain.pem and ${REMOTE_DIR}/certs/privkey.pem on ${DEPLOY_HOST} before starting nginx."
fi

log "starting remote compose stack with BACKEND_IMAGE=${IMAGE_REF}"
ssh "$DEPLOY_HOST" "cd ${REMOTE_DIR} && BACKEND_IMAGE='${IMAGE_REF}' docker compose --env-file .env up -d"

log "checking remote /readyz"
ssh "$DEPLOY_HOST" "curl -fsS http://127.0.0.1/readyz"

log "deployed ${IMAGE_REF}"

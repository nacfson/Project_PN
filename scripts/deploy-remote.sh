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
  USE_GHCR=1                         # default: push/pull multi-arch via GHCR
  GHCR_OWNER=nacfson
  GHCR_IMAGE=project-pn-backend
  PLATFORMS=linux/amd64,linux/arm64
  GHCR_TOKEN=<pat with write:packages> # also used for remote docker login if private
  PLATFORM=linux/amd64                # only used when USE_GHCR=0 (legacy tarball)

Default path (USE_GHCR=1): builds a multi-arch image, pushes to GHCR, then
the remote server pulls that image and starts Compose.

Legacy path (USE_GHCR=0): builds locally, uploads a tarball over SCP, and
docker load on the remote server.
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
USE_GHCR="${USE_GHCR:-1}"
GHCR_OWNER="${GHCR_OWNER:-nacfson}"
GHCR_IMAGE="${GHCR_IMAGE:-project-pn-backend}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
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
case "$USE_GHCR" in
  1|0) ;;
  *) die "USE_GHCR must be 1 or 0" ;;
esac

require_cmd docker
require_cmd git
require_cmd openssl
require_cmd scp
require_cmd ssh
require_cmd npm
if [[ "$USE_GHCR" == "0" ]]; then
  require_cmd gzip
fi

IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
LOCAL_IMAGE_REF="${IMAGE_NAME}:${IMAGE_TAG}"
LOCAL_LATEST_REF="${IMAGE_NAME}:latest"
GHCR_IMAGE_REF="ghcr.io/${GHCR_OWNER}/${GHCR_IMAGE}:${IMAGE_TAG}"
GHCR_LATEST_REF="ghcr.io/${GHCR_OWNER}/${GHCR_IMAGE}:latest"
if [[ "$USE_GHCR" == "1" ]]; then
  IMAGE_REF="$GHCR_IMAGE_REF"
else
  IMAGE_REF="$LOCAL_IMAGE_REF"
fi
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

if [[ "$USE_GHCR" == "1" ]]; then
  log "publishing multi-arch image to GHCR (${PLATFORMS})"
  PLATFORMS="$PLATFORMS" IMAGE_TAG="$IMAGE_TAG" \
    GHCR_OWNER="$GHCR_OWNER" GHCR_IMAGE="$GHCR_IMAGE" \
    scripts/push-ghcr.sh
else
  log "building ${IMAGE_REF} for ${PLATFORM} (legacy tarball path)"
  docker build --platform "$PLATFORM" -t "$IMAGE_REF" -f backend/Dockerfile backend

  SAVE_REFS=("$IMAGE_REF")
  if [[ "$IMAGE_REF" != "$LOCAL_LATEST_REF" ]]; then
    log "tagging ${LOCAL_LATEST_REF}"
    docker tag "$IMAGE_REF" "$LOCAL_LATEST_REF"
    SAVE_REFS+=("$LOCAL_LATEST_REF")
  fi

  log "saving image to ${TARBALL}"
  docker save "${SAVE_REFS[@]}" | gzip > "$TARBALL"
fi

log "building frontend web bundle"
(
  cd frontend
  npm install --legacy-peer-deps
  # Empty EXPO_PUBLIC_API_BASE_URL lets the web app resolve API calls from
  # window.location.origin, which works for both intranet and public IPs when
  # the bundle is served by nginx on the same origin.
  # Empty API base → same-origin; bake Brain auth host for Sign In.
  EXPO_PUBLIC_API_BASE_URL= \
    EXPO_PUBLIC_CENTRAL_AUTH_URL="${EXPO_PUBLIC_CENTRAL_AUTH_URL:-https://auth.nacfson.cloud}" \
    npm run web:export
)

log "creating remote deploy directories on ${DEPLOY_HOST}:${REMOTE_DIR}"
ssh "$DEPLOY_HOST" "mkdir -p ${REMOTE_DIR}/nginx ${REMOTE_DIR}/certs ${REMOTE_DIR}/web"

log "uploading compose files and web bundle"
scp deploy/compose.yaml "$DEPLOY_HOST:${REMOTE_DIR}/compose.yaml"
scp deploy/.env.example "$DEPLOY_HOST:${REMOTE_DIR}/.env.example"
scp deploy/nginx/nginx.conf "$DEPLOY_HOST:${REMOTE_DIR}/nginx/nginx.conf"
scp -r frontend/dist/. "$DEPLOY_HOST:${REMOTE_DIR}/web/"

if [[ "$USE_GHCR" == "1" ]]; then
  log "pulling ${IMAGE_REF} on remote server"
  GHCR_TOKEN_VALUE="${GHCR_TOKEN:-${GH_TOKEN:-${GITHUB_TOKEN:-}}}"
  if [[ -n "$GHCR_TOKEN_VALUE" ]]; then
    log "logging remote docker into ghcr.io"
    printf '%s\n' "$GHCR_TOKEN_VALUE" | ssh "$DEPLOY_HOST" "docker login ghcr.io -u $(printf '%q' "${GHCR_USERNAME:-$GHCR_OWNER}") --password-stdin >/dev/null"
  fi
  ssh "$DEPLOY_HOST" "docker pull $(printf '%q' "$IMAGE_REF")"
  # Also tag :latest on the server for compose defaults / rollback convenience.
  ssh "$DEPLOY_HOST" "docker tag $(printf '%q' "$IMAGE_REF") $(printf '%q' "$GHCR_LATEST_REF")"
else
  log "uploading and loading image tarball on remote server"
  scp "$TARBALL" "$DEPLOY_HOST:${REMOTE_TARBALL}"
  ssh "$DEPLOY_HOST" "docker load -i ${REMOTE_TARBALL} && rm -f ${REMOTE_TARBALL}"
fi

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

BACKEND_IMAGE=${IMAGE_REF}

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
AUTH_MODE=${AUTH_MODE:-local}
CENTRAL_AUTH_URL=${CENTRAL_AUTH_URL:-}
REQUIRE_EMAIL_VERIFIED=false
SESSION_TTL=720h
MAGIC_LINK_TTL=15m
EXCHANGE_CODE_TTL=5m
APP_PUBLIC_URL=${DEPLOY_PUBLIC_URL}
WEB_APP_PUBLIC_URL=${DEPLOY_PUBLIC_URL}

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
ssh "$DEPLOY_HOST" "curl -fsS http://127.0.0.1:53412/readyz"

log "deployed ${IMAGE_REF}"

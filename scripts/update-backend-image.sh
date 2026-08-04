#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/update-backend-image.sh
  DEPLOY_HOST=zlUbuntu scripts/update-backend-image.sh

Rebuilds the Go backend Docker image, uploads it to zlUbuntu, syncs deploy
compose/nginx config, and restarts the api (and migrate) services.

Does NOT rebuild or upload the frontend web bundle. Use scripts/deploy-remote.sh
(or the deploy-web-ubuntu skill) when the Expo web UI must change too.

Optional environment variables:
  DEPLOY_ENV_FILE=deploy/.deploy.env
  REMOTE_DIR=~/project-pn/deploy
  IMAGE_NAME=project-pn-backend
  IMAGE_TAG=<git-short-sha>
  PLATFORM=linux/amd64
  SYNC_DEPLOY_CONFIG=1   # set 0 to skip uploading compose/nginx/.env.example
USAGE
}

log() {
  printf '[update-image] %s\n' "$*"
}

die() {
  printf '[update-image] ERROR: %s\n' "$*" >&2
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

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-deploy/.deploy.env}"
if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  log "loading ${DEPLOY_ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
  set +a
fi

DEPLOY_HOST="${DEPLOY_HOST:-}"
REMOTE_DIR="${REMOTE_DIR:-~/project-pn/deploy}"
IMAGE_NAME="${IMAGE_NAME:-project-pn-backend}"
PLATFORM="${PLATFORM:-linux/amd64}"
SYNC_DEPLOY_CONFIG="${SYNC_DEPLOY_CONFIG:-1}"

[[ -n "$DEPLOY_HOST" ]] || die "DEPLOY_HOST is required, for example DEPLOY_HOST=zlUbuntu (or set deploy/.deploy.env)"
safe_remote_path "$REMOTE_DIR"

require_cmd docker
require_cmd git
require_cmd gzip
require_cmd scp
require_cmd ssh

IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
IMAGE_REF="${IMAGE_NAME}:${IMAGE_TAG}"
LATEST_REF="${IMAGE_NAME}:latest"
TARBALL="${TMPDIR:-/tmp}/${IMAGE_NAME}-${IMAGE_TAG}.tar.gz"
REMOTE_TARBALL="/tmp/${IMAGE_NAME}-${IMAGE_TAG}.tar.gz"

cleanup() {
  rm -f "$TARBALL"
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

log "creating remote deploy directories on ${DEPLOY_HOST}:${REMOTE_DIR}"
ssh "$DEPLOY_HOST" "mkdir -p ${REMOTE_DIR}/nginx ${REMOTE_DIR}/certs ${REMOTE_DIR}/web"

if [[ "$SYNC_DEPLOY_CONFIG" == "1" ]]; then
  log "syncing compose/nginx config (no frontend bundle)"
  scp deploy/compose.yaml "$DEPLOY_HOST:${REMOTE_DIR}/compose.yaml"
  scp deploy/.env.example "$DEPLOY_HOST:${REMOTE_DIR}/.env.example"
  scp deploy/nginx/nginx.conf "$DEPLOY_HOST:${REMOTE_DIR}/nginx/nginx.conf"
fi

log "uploading image tarball"
scp "$TARBALL" "$DEPLOY_HOST:${REMOTE_TARBALL}"

log "loading image on remote server"
ssh "$DEPLOY_HOST" "docker load -i ${REMOTE_TARBALL} && rm -f ${REMOTE_TARBALL}"

if ! ssh "$DEPLOY_HOST" "test -f ${REMOTE_DIR}/.env"; then
  die "remote ${REMOTE_DIR}/.env is missing; run scripts/deploy-remote.sh once to bootstrap the stack"
fi

# Ensure ADMIN_LOG_PATH is present so the admin audit volume path is wired.
if ! ssh "$DEPLOY_HOST" "grep -q '^ADMIN_LOG_PATH=' ${REMOTE_DIR}/.env"; then
  log "adding ADMIN_LOG_PATH to remote .env"
  ssh "$DEPLOY_HOST" "printf '\nADMIN_LOG_PATH=/var/log/project-pn/admin.log\n' >> ${REMOTE_DIR}/.env"
fi

log "restarting remote stack with BACKEND_IMAGE=${IMAGE_REF}"
ssh "$DEPLOY_HOST" "cd ${REMOTE_DIR} && BACKEND_IMAGE='${IMAGE_REF}' docker compose --env-file .env up -d"

log "checking remote /readyz"
ssh "$DEPLOY_HOST" "curl -fsS http://127.0.0.1:53412/readyz"

log "updated ${IMAGE_REF} (frontend web bundle unchanged)"

#!/usr/bin/env bash
set -euo pipefail

# GHCR-based deploy for Project PN.
#
# Unlike scripts/deploy-remote.sh (which saves the image to a tarball and copies
# it over SSH), this script builds the backend image, pushes it to GitHub
# Container Registry, then tells the server to pull it and start the stack.
#
# It still uploads the compose file, nginx config, and the exported web bundle,
# since those are not part of the backend image.
#
# Prereqs (local):
#   - docker logged in to ghcr.io with write:packages
#       echo "$CR_PAT" | docker login ghcr.io -u <github-username> --password-stdin
#   - deploy/.deploy.env configured (see deploy/.deploy.env.example)
# Prereqs (server), only when the GHCR package is private:
#   - docker logged in to ghcr.io with read:packages
#
# Usage:
#   scripts/deploy-ghcr.sh
#   DEPLOY_HOST=ec2-user@1.2.3.4 IMAGE_OWNER=nacfson scripts/deploy-ghcr.sh

log() { printf '[deploy-ghcr] %s\n' "$*"; }
die() { printf '[deploy-ghcr] ERROR: %s\n' "$*" >&2; exit 1; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }

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
PLATFORM="${PLATFORM:-linux/amd64}"
IMAGE_OWNER="${IMAGE_OWNER:-nacfson}"
IMAGE_NAME="${IMAGE_NAME:-project-pn-backend}"
REGISTRY="${REGISTRY:-ghcr.io}"

[[ -n "$DEPLOY_HOST" ]] || die "DEPLOY_HOST is required, e.g. DEPLOY_HOST=ec2-user@server-ip"

require_cmd docker
require_cmd git
require_cmd npm
require_cmd scp
require_cmd ssh

IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
IMAGE_REF="${REGISTRY}/${IMAGE_OWNER}/${IMAGE_NAME}:${IMAGE_TAG}"

log "building and pushing ${IMAGE_REF} for ${PLATFORM}"
docker buildx build \
  --platform "$PLATFORM" \
  -t "$IMAGE_REF" \
  -f backend/Dockerfile \
  --push \
  backend

log "building frontend web bundle"
(
  cd frontend
  npm install --legacy-peer-deps
  # Empty EXPO_PUBLIC_API_BASE_URL lets the web app resolve API calls from
  # window.location.origin, so the same bundle works on any host origin.
  EXPO_PUBLIC_API_BASE_URL= npm run web:export
)

log "creating remote deploy directories on ${DEPLOY_HOST}:${REMOTE_DIR}"
ssh "$DEPLOY_HOST" "mkdir -p ${REMOTE_DIR}/nginx ${REMOTE_DIR}/certs ${REMOTE_DIR}/web"

log "uploading compose file, nginx config, and web bundle"
scp deploy/compose.yaml "$DEPLOY_HOST:${REMOTE_DIR}/compose.yaml"
scp deploy/.env.example "$DEPLOY_HOST:${REMOTE_DIR}/.env.example"
scp deploy/nginx/nginx.conf "$DEPLOY_HOST:${REMOTE_DIR}/nginx/nginx.conf"
scp -r frontend/dist/. "$DEPLOY_HOST:${REMOTE_DIR}/web/"

ssh "$DEPLOY_HOST" "test -f ${REMOTE_DIR}/.env" \
  || die "remote ${REMOTE_DIR}/.env is missing. Create it from .env.example (set POSTGRES_PASSWORD, DATABASE_URL, ALLOWED_ORIGINS, APP_PUBLIC_URL) before deploying."

log "pulling ${IMAGE_REF} and starting the stack on ${DEPLOY_HOST}"
ssh "$DEPLOY_HOST" "cd ${REMOTE_DIR} && BACKEND_IMAGE='${IMAGE_REF}' docker compose --env-file .env pull && BACKEND_IMAGE='${IMAGE_REF}' docker compose --env-file .env up -d"

log "checking remote /readyz"
ssh "$DEPLOY_HOST" "curl -fsS http://127.0.0.1:53412/readyz"

log "deployed ${IMAGE_REF}"

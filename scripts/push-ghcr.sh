#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/push-ghcr.sh
  TARGET=frontend scripts/push-ghcr.sh
  TARGET=all scripts/push-ghcr.sh

Builds multi-arch Project PN images and pushes them to GHCR.

Required:
  GHCR_TOKEN   GitHub PAT with write:packages (preferred)
  # or GH_TOKEN / GITHUB_TOKEN as fallback

Optional environment variables:
  TARGET=backend|frontend|all       # default: backend
  GHCR_OWNER=nacfson
  IMAGE_TAG=<git-short-sha>
  PLATFORMS=linux/amd64,linux/arm64
  GHCR_USERNAME=<github-username>   # defaults to GHCR_OWNER
  PUSH_LATEST=1                     # also push :latest (default 1)
  BUILDX_BUILDER=project-pn-multi   # buildx builder name

Images:
  backend  → ghcr.io/<owner>/project-pn-backend
  frontend → ghcr.io/<owner>/project-pn-frontend  (nginx SPA from frontend/dist)

Example:
  GHCR_TOKEN=ghp_... TARGET=frontend scripts/push-ghcr.sh
  GHCR_TOKEN=ghp_... TARGET=all scripts/push-ghcr.sh
USAGE
}

log() {
  printf '[push-ghcr] %s\n' "$*"
}

die() {
  printf '[push-ghcr] ERROR: %s\n' "$*" >&2
  exit 1
}

push_image() {
  local image_name="$1"
  local dockerfile="$2"
  local context="$3"
  local registry_image="ghcr.io/${GHCR_OWNER}/${image_name}"
  local sha_ref="${registry_image}:${IMAGE_TAG}"
  local latest_ref="${registry_image}:latest"
  local tags=(-t "$sha_ref")

  if [[ "$PUSH_LATEST" == "1" ]]; then
    tags+=(-t "$latest_ref")
  fi

  log "building and pushing ${sha_ref} for ${PLATFORMS}"
  docker buildx build \
    --builder "$BUILDX_BUILDER" \
    --platform "$PLATFORMS" \
    "${tags[@]}" \
    -f "$dockerfile" \
    --push \
    "$context"

  log "published ${sha_ref} (${PLATFORMS})"
  if [[ "$PUSH_LATEST" == "1" ]]; then
    log "published ${latest_ref} (${PLATFORMS})"
  fi
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

TARGET="${TARGET:-backend}"
GHCR_OWNER="${GHCR_OWNER:-nacfson}"
GHCR_USERNAME="${GHCR_USERNAME:-$GHCR_OWNER}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
PUSH_LATEST="${PUSH_LATEST:-1}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
BUILDX_BUILDER="${BUILDX_BUILDER:-project-pn-multi}"

case "$TARGET" in
  backend|frontend|all) ;;
  *) die "TARGET must be backend, frontend, or all (got: ${TARGET})" ;;
esac

TOKEN="${GHCR_TOKEN:-${GH_TOKEN:-${GITHUB_TOKEN:-}}}"
[[ -n "$TOKEN" ]] || die "set GHCR_TOKEN (or GH_TOKEN / GITHUB_TOKEN) with write:packages"
command -v docker >/dev/null 2>&1 || die "missing required command: docker"
command -v git >/dev/null 2>&1 || die "missing required command: git"

if ! docker info >/dev/null 2>&1; then
  die "docker daemon is not running"
fi

log "logging in to ghcr.io as ${GHCR_USERNAME}"
echo "$TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin >/dev/null

if ! docker buildx inspect "$BUILDX_BUILDER" >/dev/null 2>&1; then
  log "creating buildx builder ${BUILDX_BUILDER}"
  docker buildx create --name "$BUILDX_BUILDER" --driver docker-container --platform linux/amd64,linux/arm64 >/dev/null
fi
docker buildx use "$BUILDX_BUILDER"
docker buildx inspect --bootstrap >/dev/null

if [[ "$TARGET" == "frontend" || "$TARGET" == "all" ]]; then
  command -v npm >/dev/null 2>&1 || die "missing required command: npm (needed to build frontend/dist)"
  log "building frontend web bundle into frontend/dist"
  (
    cd frontend
    npm install --legacy-peer-deps
    # Empty base URL → SPA calls same origin; Ingress/nginx proxies /api to backend.
    EXPO_PUBLIC_API_BASE_URL= npm run web:export
  )
  [[ -d frontend/dist ]] || die "frontend/dist missing after web:export"
  push_image "project-pn-frontend" "frontend/Dockerfile.web" "frontend"
fi

if [[ "$TARGET" == "backend" || "$TARGET" == "all" ]]; then
  push_image "project-pn-backend" "backend/Dockerfile" "backend"
fi

log "done"

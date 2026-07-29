#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/push-ghcr.sh

Builds the Project PN backend image and pushes it to GHCR.

Required:
  GHCR_TOKEN   GitHub PAT with write:packages (preferred)
  # or GH_TOKEN / GITHUB_TOKEN as fallback

Optional environment variables:
  GHCR_OWNER=nacfson
  GHCR_IMAGE=project-pn-backend
  IMAGE_TAG=<git-short-sha>
  PLATFORM=linux/amd64
  GHCR_USERNAME=<github-username>   # defaults to GHCR_OWNER
  PUSH_LATEST=1                     # also push :latest (default 1)

Example:
  GHCR_TOKEN=ghp_... scripts/push-ghcr.sh
USAGE
}

log() {
  printf '[push-ghcr] %s\n' "$*"
}

die() {
  printf '[push-ghcr] ERROR: %s\n' "$*" >&2
  exit 1
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

GHCR_OWNER="${GHCR_OWNER:-nacfson}"
GHCR_IMAGE="${GHCR_IMAGE:-project-pn-backend}"
GHCR_USERNAME="${GHCR_USERNAME:-$GHCR_OWNER}"
PLATFORM="${PLATFORM:-linux/amd64}"
PUSH_LATEST="${PUSH_LATEST:-1}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"

REGISTRY_IMAGE="ghcr.io/${GHCR_OWNER}/${GHCR_IMAGE}"
SHA_REF="${REGISTRY_IMAGE}:${IMAGE_TAG}"
LATEST_REF="${REGISTRY_IMAGE}:latest"

TOKEN="${GHCR_TOKEN:-${GH_TOKEN:-${GITHUB_TOKEN:-}}}"
[[ -n "$TOKEN" ]] || die "set GHCR_TOKEN (or GH_TOKEN / GITHUB_TOKEN) with write:packages"
command -v docker >/dev/null 2>&1 || die "missing required command: docker"
command -v git >/dev/null 2>&1 || die "missing required command: git"

if ! docker info >/dev/null 2>&1; then
  die "docker daemon is not running"
fi

log "logging in to ghcr.io as ${GHCR_USERNAME}"
echo "$TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin >/dev/null

log "building ${SHA_REF} for ${PLATFORM}"
docker build --platform "$PLATFORM" -t "$SHA_REF" -f backend/Dockerfile backend

log "pushing ${SHA_REF}"
docker push "$SHA_REF"

if [[ "$PUSH_LATEST" == "1" ]]; then
  log "tagging ${LATEST_REF}"
  docker tag "$SHA_REF" "$LATEST_REF"
  log "pushing ${LATEST_REF}"
  docker push "$LATEST_REF"
fi

log "done"
log "  ${SHA_REF}"
if [[ "$PUSH_LATEST" == "1" ]]; then
  log "  ${LATEST_REF}"
fi

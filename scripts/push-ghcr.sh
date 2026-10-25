#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/push-ghcr.sh [--cloud] [--watch] [--ref <git-ref>]
  TARGET=frontend scripts/push-ghcr.sh [--watch]
  TARGET=backend scripts/push-ghcr.sh [--watch]
  TARGET=all scripts/push-ghcr.sh [--watch]

Dispatches a GitHub Actions cloud session (.github/workflows/publish-ghcr-images.yml)
to build and publish multi-arch Project PN images (linux/amd64, linux/arm64) to GHCR.
Local Docker Buildx builds are retired; all builds run in GitHub's cloud runners.

Options:
  --cloud           Run build in GitHub Actions cloud session (default)
  --watch           Stream the GitHub Actions workflow run until completion
  --ref <git-ref>   Git branch or ref to build on GitHub (defaults to current branch)
  -h, --help        Show this help message

Optional environment variables:
  TARGET=all|backend|frontend       # default: all
  GIT_REF=<git-branch-or-tag>       # defaults to current git branch
  WATCH=1                           # same as --watch

Images published by the GitHub Actions workflow:
  backend  → ghcr.io/<owner>/project-pn-backend
  frontend → ghcr.io/<owner>/project-pn-frontend  (nginx SPA from frontend/dist)

Examples:
  scripts/push-ghcr.sh --watch
  TARGET=frontend scripts/push-ghcr.sh --watch
  TARGET=backend scripts/push-ghcr.sh --ref main --watch
USAGE
}

log() {
  printf '[push-ghcr] %s\n' "$*"
}

die() {
  printf '[push-ghcr] ERROR: %s\n' "$*" >&2
  exit 1
}

BUILD_MODE="${BUILD_MODE:-cloud}"
WATCH="${WATCH:-0}"
GIT_REF="${GIT_REF:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --cloud)
      BUILD_MODE="cloud"
      shift
      ;;
    --local)
      BUILD_MODE="local"
      shift
      ;;
    --watch)
      WATCH="1"
      shift
      ;;
    --ref)
      [[ $# -ge 2 ]] || die "--ref requires a branch or tag argument"
      GIT_REF="$2"
      shift 2
      ;;
    *)
      die "unknown option: $1 (run with --help for usage)"
      ;;
  esac
done

TARGET="${TARGET:-all}"
case "$TARGET" in
  backend|frontend|all) ;;
  *) die "TARGET must be backend, frontend, or all (got: ${TARGET})" ;;
esac

if [[ "$BUILD_MODE" != "cloud" ]]; then
  die "local builds are retired; all image builds run in GitHub Actions cloud sessions (publish-ghcr-images.yml)"
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

command -v git >/dev/null 2>&1 || die "missing required command: git"
command -v gh >/dev/null 2>&1 || die "missing required command: gh (GitHub CLI)"

if [[ -z "$GIT_REF" ]]; then
  GIT_REF="$(git rev-parse --abbrev-ref HEAD)"
  [[ "$GIT_REF" != "HEAD" ]] || die "detached HEAD; pass --ref <branch> or set GIT_REF"
fi

log "dispatching GitHub Actions cloud build workflow publish-ghcr-images.yml (ref=${GIT_REF}, target=${TARGET})"
gh workflow run publish-ghcr-images.yml --ref "$GIT_REF" -f target="$TARGET"

if [[ "$WATCH" == "1" ]]; then
  sleep 2
  run_id="$(gh run list --workflow=publish-ghcr-images.yml --branch "$GIT_REF" --limit 1 --json databaseId --jq '.[0].databaseId')"
  [[ -n "$run_id" && "$run_id" != "null" ]] || die "could not locate newly dispatched workflow run on branch ${GIT_REF}"
  log "watching GitHub Actions run ${run_id}..."
  gh run watch "$run_id" --exit-status
else
  log "dispatched! Run 'gh run list --workflow=publish-ghcr-images.yml' or pass --watch to stream progress."
fi

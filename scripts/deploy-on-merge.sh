#!/usr/bin/env bash
# Run after PR merge to main (Cursor Automation / My Machines or manual).
# Skips deploy when merge did not touch deployable paths; otherwise runs deploy-remote.sh.
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/deploy-on-merge.sh
  scripts/deploy-on-merge.sh --check-only

Compares the latest merge on main against its first parent. If no deployable
paths changed, exits 0 without deploying. Otherwise runs scripts/deploy-remote.sh.

Environment:
  DEPLOY_MERGE_BASE   Optional explicit base ref (default: HEAD^1 on main)
  DEPLOY_SKIP_PATH_CHECK=1   Force deploy even when paths unchanged (debug)
USAGE
}

log() {
  printf '[deploy-on-merge] %s\n' "$*"
}

die() {
  printf '[deploy-on-merge] ERROR: %s\n' "$*" >&2
  exit 1
}

CHECK_ONLY=false
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi
if [[ "${1:-}" == "--check-only" ]]; then
  CHECK_ONLY=true
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

DEPLOY_PATHS=(
  'backend/'
  'frontend/'
  'deploy/'
  'scripts/deploy-remote.sh'
  'scripts/deploy-on-merge.sh'
)

current_branch="$(git branch --show-current)"
if [[ "$current_branch" != "main" ]]; then
  die "must be on main branch (current: ${current_branch:-detached})"
fi

if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  die "no HEAD commit"
fi

MERGE_BASE="${DEPLOY_MERGE_BASE:-HEAD^1}"
if ! git rev-parse --verify "$MERGE_BASE" >/dev/null 2>&1; then
  die "cannot resolve merge base ${MERGE_BASE}"
fi

changed_files="$(git diff --name-only "$MERGE_BASE" HEAD)"
deploy_needed=false
while IFS= read -r file; do
  [[ -n "$file" ]] || continue
  for prefix in "${DEPLOY_PATHS[@]}"; do
    if [[ "$file" == "$prefix" || "$file" == "${prefix%/}"/* ]]; then
      deploy_needed=true
      break 2
    fi
  done
done <<<"$changed_files"

if [[ "${DEPLOY_SKIP_PATH_CHECK:-}" == "1" ]]; then
  deploy_needed=true
fi

if [[ "$deploy_needed" != true ]]; then
  log "no deployable paths changed between ${MERGE_BASE} and HEAD; skipping deploy"
  exit 0
fi

log "deployable paths changed; will run deploy-remote.sh"
if [[ "$CHECK_ONLY" == true ]]; then
  exit 0
fi

command -v docker >/dev/null 2>&1 || die "docker not found; start Docker Desktop"
docker info >/dev/null 2>&1 || die "docker daemon not running"

exec "${REPO_ROOT}/scripts/deploy-remote.sh"

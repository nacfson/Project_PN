#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/remote-logs.sh [target] [options]

Fetch or follow Project PN logs on the remote deploy host (zlUbuntu).

Targets:
  (default)   Last N lines across all compose services
  api         API container stdout (slog)
  nginx       Nginx access + error streams
  postgres    Postgres logs
  migrate     Migration job logs
  admin       Admin audit file (/var/log/project-pn/admin.log)
  errors      Grep ERROR|panic|FATAL|ENRICH_FAIL across api + admin

Options:
  -f, --follow       Follow log output (not for migrate)
  -n, --tail N       Number of lines (default: 200)
  -h, --help         Show this help

Environment (same as deploy-remote.sh):
  DEPLOY_ENV_FILE=deploy/.deploy.env
  DEPLOY_HOST=zlUbuntu
  REMOTE_DIR=~/project-pn/deploy

Examples:
  scripts/remote-logs.sh
  scripts/remote-logs.sh api -f
  scripts/remote-logs.sh admin -f
  scripts/remote-logs.sh nginx --tail 100
  scripts/remote-logs.sh errors
USAGE
}

log() {
  printf '[remote-logs] %s\n' "$*"
}

die() {
  printf '[remote-logs] ERROR: %s\n' "$*" >&2
  exit 1
}

safe_remote_path() {
  case "$1" in
    *[!A-Za-z0-9_./~:-]*)
      die "REMOTE_DIR contains unsupported characters: $1"
      ;;
  esac
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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

TARGET="all"
FOLLOW=0
TAIL=200

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    -f|--follow)
      FOLLOW=1
      shift
      ;;
    -n|--tail)
      [[ $# -ge 2 ]] || die "--tail requires a number"
      TAIL="$2"
      [[ "$TAIL" =~ ^[0-9]+$ ]] || die "--tail must be a non-negative integer"
      shift 2
      ;;
    --tail=*)
      TAIL="${1#--tail=}"
      [[ "$TAIL" =~ ^[0-9]+$ ]] || die "--tail must be a non-negative integer"
      shift
      ;;
    api|nginx|postgres|migrate|admin|errors|all)
      TARGET="$1"
      shift
      ;;
    *)
      die "unknown argument: $1 (try --help)"
      ;;
  esac
done

[[ -n "$DEPLOY_HOST" ]] || die "DEPLOY_HOST is required, for example DEPLOY_HOST=zlUbuntu (or set deploy/.deploy.env)"
safe_remote_path "$REMOTE_DIR"
command -v ssh >/dev/null 2>&1 || die "missing required command: ssh"

FOLLOW_ARGS=""
if [[ "$FOLLOW" -eq 1 ]]; then
  FOLLOW_ARGS="-f"
fi

ADMIN_LOG_PATH="/var/log/project-pn/admin.log"

case "$TARGET" in
  all)
    log "fetching last ${TAIL} lines from all services on ${DEPLOY_HOST}"
    # shellcheck disable=SC2029
    ssh "$DEPLOY_HOST" "cd ${REMOTE_DIR} && docker compose logs --tail ${TAIL} ${FOLLOW_ARGS}"
    ;;
  api|nginx|postgres|migrate)
    if [[ "$TARGET" == "migrate" && "$FOLLOW" -eq 1 ]]; then
      die "migrate is a one-shot job; omit --follow"
    fi
    log "fetching ${TARGET} logs (tail=${TAIL}) on ${DEPLOY_HOST}"
    # shellcheck disable=SC2029
    ssh "$DEPLOY_HOST" "cd ${REMOTE_DIR} && docker compose logs --tail ${TAIL} ${FOLLOW_ARGS} ${TARGET}"
    ;;
  admin)
    log "fetching admin audit log on ${DEPLOY_HOST}"
    if [[ "$FOLLOW" -eq 1 ]]; then
      # shellcheck disable=SC2029
      ssh "$DEPLOY_HOST" "cd ${REMOTE_DIR} && docker compose exec -T api tail -n ${TAIL} -f ${ADMIN_LOG_PATH}"
    else
      # shellcheck disable=SC2029
      ssh "$DEPLOY_HOST" "cd ${REMOTE_DIR} && docker compose exec -T api tail -n ${TAIL} ${ADMIN_LOG_PATH}"
    fi
    ;;
  errors)
    log "scanning api + admin for ERROR|panic|FATAL|ENRICH_FAIL on ${DEPLOY_HOST}"
    # shellcheck disable=SC2029
    ssh "$DEPLOY_HOST" "cd ${REMOTE_DIR} && {
      echo '=== api (compose) ==='
      docker compose logs --tail ${TAIL} api 2>/dev/null | grep -E 'ERROR|panic|FATAL|ENRICH_FAIL' || true
      echo '=== admin.log ==='
      docker compose exec -T api sh -c 'tail -n ${TAIL} ${ADMIN_LOG_PATH} 2>/dev/null' | grep -E 'ERROR|panic|FATAL|ENRICH_FAIL|AUTH_FAILURE' || true
    }"
    ;;
esac

#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  QUICK_TUNNEL_ACK=public-test-only DEPLOY_HOST=user@server scripts/start-remote-quick-tunnel.sh
  QUICK_TUNNEL_ACK=public-test-only scripts/start-remote-quick-tunnel.sh  # if deploy/.deploy.env exists
  QUICK_TUNNEL_ACTION=status scripts/start-remote-quick-tunnel.sh
  QUICK_TUNNEL_ACTION=stop scripts/start-remote-quick-tunnel.sh

This starts a Cloudflare TryCloudflare quick tunnel on the remote host and
prints the generated public URL. Quick tunnels are for testing/development only;
use a named Cloudflare Tunnel, public cloud host, or router port-forward + TLS
for a durable deployment.

Optional environment variables:
  DEPLOY_ENV_FILE=deploy/.deploy.env
  REMOTE_DIR=~/project-pn/deploy
  QUICK_TUNNEL_URL=http://localhost:80
  QUICK_TUNNEL_ACTION=start|status|stop
  UPDATE_REMOTE_ENV=false
USAGE
}

log() {
  printf '[quick-tunnel] %s\n' "$*"
}

die() {
  printf '[quick-tunnel] ERROR: %s\n' "$*" >&2
  exit 1
}

quote_remote() {
  printf "%s" "$1" | sed "s/'/'\\\\''/g; s/^/'/; s/$/'/"
}

safe_remote_path() {
  case "$1" in
    *[!A-Za-z0-9_./~:-]*)
      die "REMOTE_DIR contains unsupported characters: $1"
      ;;
  esac
}

extract_tunnel_url() {
  sed -n 's/.*\(https:\/\/[-A-Za-z0-9.]*\.trycloudflare\.com\).*/\1/p' | tail -1
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-deploy/.deploy.env}"
if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  log "loading ${DEPLOY_ENV_FILE}"
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
fi

DEPLOY_HOST="${DEPLOY_HOST:-}"
REMOTE_DIR="${REMOTE_DIR:-~/project-pn/deploy}"
QUICK_TUNNEL_URL="${QUICK_TUNNEL_URL:-http://localhost:80}"
QUICK_TUNNEL_ACTION="${QUICK_TUNNEL_ACTION:-start}"
UPDATE_REMOTE_ENV="${UPDATE_REMOTE_ENV:-false}"

[[ -n "$DEPLOY_HOST" ]] || die "DEPLOY_HOST is required"
safe_remote_path "$REMOTE_DIR"

case "$QUICK_TUNNEL_ACTION" in
  start|status|stop) ;;
  *) die "QUICK_TUNNEL_ACTION must be start, status, or stop" ;;
esac

case "$UPDATE_REMOTE_ENV" in
  true|false) ;;
  *) die "UPDATE_REMOTE_ENV must be true or false" ;;
esac

if [[ "$QUICK_TUNNEL_ACTION" != "start" ]]; then
  UPDATE_REMOTE_ENV=false
fi

if [[ "$QUICK_TUNNEL_ACTION" == "start" && "${QUICK_TUNNEL_ACK:-}" != "public-test-only" ]]; then
  die "set QUICK_TUNNEL_ACK=public-test-only to acknowledge this exposes staging through a temporary public Cloudflare URL"
fi

if [[ "$QUICK_TUNNEL_ACTION" == "status" ]]; then
  ssh "$DEPLOY_HOST" "cd ${REMOTE_DIR}; if [ -f cloudflared.pid ] && kill -0 \$(cat cloudflared.pid) 2>/dev/null; then printf 'running pid=%s\n' \"\$(cat cloudflared.pid)\"; sed -n '1,160p' cloudflared.log 2>/dev/null | sed -n 's/.*\(https:\/\/[-A-Za-z0-9.]*\.trycloudflare\.com\).*/url=\1/p' | tail -1; else printf 'stopped\n'; fi"
  exit 0
fi

if [[ "$QUICK_TUNNEL_ACTION" == "stop" ]]; then
  log "stopping quick tunnel on ${DEPLOY_HOST}"
  ssh "$DEPLOY_HOST" "cd ${REMOTE_DIR}; if [ -f cloudflared.pid ] && kill -0 \$(cat cloudflared.pid) 2>/dev/null; then kill \$(cat cloudflared.pid); printf 'stopped pid=%s\n' \"\$(cat cloudflared.pid)\"; else printf 'already stopped\n'; fi"
  exit 0
fi

log "ensuring cloudflared exists on ${DEPLOY_HOST}"
ssh "$DEPLOY_HOST" "set -e; mkdir -p ~/bin; if ! command -v cloudflared >/dev/null 2>&1 && [ ! -x ~/bin/cloudflared ]; then curl -fL --retry 3 -o ~/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64; chmod 755 ~/bin/cloudflared; fi"

REMOTE_URL="$(quote_remote "$QUICK_TUNNEL_URL")"
log "starting quick tunnel to ${QUICK_TUNNEL_URL}"
ssh "$DEPLOY_HOST" "set -e; cd ${REMOTE_DIR}; if [ -f cloudflared.pid ] && kill -0 \$(cat cloudflared.pid) 2>/dev/null; then kill \$(cat cloudflared.pid); fi; rm -f cloudflared.log; nohup ~/bin/cloudflared tunnel --no-autoupdate --url ${REMOTE_URL} --logfile ${REMOTE_DIR}/cloudflared.log --loglevel info >/dev/null 2>&1 & printf '%s\n' \$! > cloudflared.pid"

log "waiting for public URL"
PUBLIC_URL=""
for _ in $(seq 1 20); do
  LOG_OUTPUT="$(ssh "$DEPLOY_HOST" "cd ${REMOTE_DIR}; sed -n '1,160p' cloudflared.log 2>/dev/null" || true)"
  PUBLIC_URL="$(printf '%s\n' "$LOG_OUTPUT" | extract_tunnel_url)"
  if [[ -n "$PUBLIC_URL" ]]; then
    break
  fi
  sleep 2
done

[[ -n "$PUBLIC_URL" ]] || die "cloudflared did not print a trycloudflare.com URL; inspect ${REMOTE_DIR}/cloudflared.log on ${DEPLOY_HOST}"

if [[ "$UPDATE_REMOTE_ENV" == "true" ]]; then
  PUBLIC_URL_QUOTED="$(quote_remote "$PUBLIC_URL")"
  log "updating remote .env APP_PUBLIC_URL and ALLOWED_ORIGINS"
  ssh "$DEPLOY_HOST" "set -e; cd ${REMOTE_DIR}; test -f .env; cp .env .env.quick-tunnel.bak; awk -v url=${PUBLIC_URL_QUOTED} 'BEGIN { allowed=0; app=0 } /^ALLOWED_ORIGINS=/ { allowed=1; value=substr(\$0, index(\$0, \"=\")+1); n=split(value, origins, \",\"); found=0; for (i=1; i<=n; i++) if (origins[i] == url) found=1; print found ? \$0 : \$0 \",\" url; next } /^APP_PUBLIC_URL=/ { app=1; print \"APP_PUBLIC_URL=\" url; next } { print } END { if (!allowed) print \"ALLOWED_ORIGINS=\" url; if (!app) print \"APP_PUBLIC_URL=\" url }' .env > .env.tmp && chmod 600 .env.tmp && mv .env.tmp .env; docker compose --env-file .env up -d api nginx >/dev/null"
fi

printf '%s\n' "$PUBLIC_URL"

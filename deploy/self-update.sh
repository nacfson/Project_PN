#!/usr/bin/env bash
set -euo pipefail

# Self-update the Project PN stack on the server (pull-based deploy).
#
# Pulls the latest backend image from the registry (GHCR) and restarts the
# stack via docker compose. Intended to run periodically from the systemd timer
# in deploy/systemd/ (or cron) so the instance updates itself whenever a new
# image is published — no inbound SSH from CI or an operator is required.
#
# Requirements on the server:
#   - deploy/.env has BACKEND_IMAGE pointing at the registry ref, e.g.
#       BACKEND_IMAGE=ghcr.io/nacfson/project-pn-backend:latest
#   - if the GHCR package is private, `docker login ghcr.io` has been run once
#     as the user that runs this script (persists in ~/.docker/config.json).

DEPLOY_DIR="${DEPLOY_DIR:-$HOME/project-pn/deploy}"

log() { printf '[self-update] %s %s\n' "$(date -Is)" "$*"; }

cd "$DEPLOY_DIR" || { log "ERROR: deploy dir not found: $DEPLOY_DIR"; exit 1; }
[[ -f .env ]] || { log "ERROR: $DEPLOY_DIR/.env is missing"; exit 1; }

# Capture the api image digest before pulling so we can tell if anything changed.
before="$(docker compose --env-file .env images -q api 2>/dev/null || true)"

log "pulling images"
docker compose --env-file .env pull

after="$(docker compose --env-file .env images -q api 2>/dev/null || true)"
if [[ -n "$before" && "$before" == "$after" ]]; then
  log "no image change; nothing to do"
  exit 0
fi

# `up -d` recreates changed containers. Because compose declares
# migrate(depends_on postgres healthy) and api(depends_on migrate completed),
# migrations run before the API starts.
log "applying update"
docker compose --env-file .env up -d

log "pruning dangling images"
docker image prune -f >/dev/null 2>&1 || true

if curl -fsS http://127.0.0.1:53412/readyz >/dev/null 2>&1; then
  log "readyz OK"
else
  log "WARNING: /readyz check failed after update"
fi
log "done"

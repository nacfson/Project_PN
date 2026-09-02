#!/usr/bin/env bash
set -euo pipefail

# Sync GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET into nacfson-auth and restart auth-service.
# Reads from environment (Cursor secrets or local export). Never prints secret values.

die() { printf '[sync-auth-google] ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '[sync-auth-google] %s\n' "$*"; }

CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
SSH_KEY="${SSH_PRIVATE_KEY:-}"
SSH_USER="${DEPLOY_SSH_USER:-opc}"
SSH_HOST="${DEPLOY_SSH_HOST:-}"

[[ -n "$CLIENT_ID" ]] || die "GOOGLE_CLIENT_ID is not set"
[[ -n "$CLIENT_SECRET" ]] || die "GOOGLE_CLIENT_SECRET is not set"
[[ -n "$SSH_KEY" ]] || die "SSH_PRIVATE_KEY is not set"
[[ -n "$SSH_HOST" ]] || die "DEPLOY_SSH_HOST is not set"

log "GOOGLE_CLIENT_ID length=${#CLIENT_ID}"
log "GOOGLE_CLIENT_SECRET length=${#CLIENT_SECRET}"

TMP_KEY="$(mktemp)"
trap 'rm -f "$TMP_KEY"' EXIT
printf '%s\n' "$SSH_KEY" >"$TMP_KEY"
chmod 600 "$TMP_KEY"

ssh -i "$TMP_KEY" -o StrictHostKeyChecking=no "${SSH_USER}@${SSH_HOST}" bash -s <<REMOTE
set -euo pipefail
K="sudo KUBECONFIG=/secure/production.conf /usr/local/bin/kubectl -n nacfson-auth"

patch_secret() {
  local name="\$1"
  shift
  \$K create secret generic "\$name" \\
    --from-literal=GOOGLE_CLIENT_ID='${CLIENT_ID}' \\
    --from-literal=GOOGLE_CLIENT_SECRET='${CLIENT_SECRET}' \\
    --dry-run=client -o yaml | \$K apply -f -
}

patch_secret auth-oauth-secrets
\$K patch secret auth-bootstrap --type merge -p '{"stringData":{"GOOGLE_CLIENT_ID":"'"${CLIENT_ID}"'","GOOGLE_CLIENT_SECRET":"'"${CLIENT_SECRET}"'"}}'

\$K rollout restart deploy/auth-service
\$K rollout status deploy/auth-service --timeout=180s

\$K exec deploy/auth-service -- /central-auth 2>/dev/null || true
REMOTE

log "done — verify https://auth.nacfson.cloud/login shows an active Google button"

#!/usr/bin/env bash
# Non-destructive preflight for zlUbuntu → wlUbuntu cutover.
# Run from the home LAN Mac (this cloud VM cannot reach wlUbuntu).
set -euo pipefail

PREFIX='[cutover-wlubuntu]'
FAILS=0
DEPLOY_HOST_EXPECTED='wlUbuntu'
TARGET_IP='192.168.219.120'
REGISTRY="${TARGET_IP}:5000"

log() { printf '%s %s\n' "$PREFIX" "$*"; }
ok() { printf '%s OK: %s\n' "$PREFIX" "$*"; }
warn() { printf '%s WARN: %s\n' "$PREFIX" "$*"; }
fail() {
  printf '%s FAIL: %s\n' "$PREFIX" "$*" >&2
  FAILS=$((FAILS + 1))
}

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$REPO_ROOT" ]]; then
  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi
cd "$REPO_ROOT"

log "repo root: ${REPO_ROOT}"
log "checking cutover preflight (non-destructive)"

# --- SSH ---
if ! command -v ssh >/dev/null 2>&1; then
  fail "ssh not found"
else
  if ssh -o BatchMode=yes -o ConnectTimeout=5 "$DEPLOY_HOST_EXPECTED" 'true' 2>/dev/null; then
    REMOTE_IPS="$(ssh -o BatchMode=yes -o ConnectTimeout=5 "$DEPLOY_HOST_EXPECTED" 'hostname -I 2>/dev/null || true' || true)"
    ok "SSH to ${DEPLOY_HOST_EXPECTED}"
    if printf '%s' "$REMOTE_IPS" | grep -q "$TARGET_IP"; then
      ok "remote hostname -I includes ${TARGET_IP}"
    else
      warn "remote IPs [${REMOTE_IPS}] do not clearly include ${TARGET_IP} (verify static lease)"
    fi
  else
    fail "cannot SSH to ${DEPLOY_HOST_EXPECTED} (BatchMode). Fix ~/.ssh/config Host alias and keys."
  fi
fi

# --- deploy/.deploy.env ---
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-deploy/.deploy.env}"
if [[ ! -f "$DEPLOY_ENV_FILE" ]]; then
  fail "missing ${DEPLOY_ENV_FILE} (copy from deploy/.deploy.env.example, set DEPLOY_HOST=${DEPLOY_HOST_EXPECTED})"
else
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
  if [[ "${DEPLOY_HOST:-}" == "$DEPLOY_HOST_EXPECTED" ]]; then
    ok "${DEPLOY_ENV_FILE} DEPLOY_HOST=${DEPLOY_HOST}"
  else
    fail "${DEPLOY_ENV_FILE} DEPLOY_HOST='${DEPLOY_HOST:-}' (expected ${DEPLOY_HOST_EXPECTED})"
  fi
fi

# --- compose extra_hosts ---
COMPOSE_FILE='deploy/compose.yaml'
if [[ ! -f "$COMPOSE_FILE" ]]; then
  fail "missing ${COMPOSE_FILE}"
else
  if grep -q "auth.nacfson.cloud:${TARGET_IP}" "$COMPOSE_FILE"; then
    ok "compose extra_hosts maps auth.nacfson.cloud → ${TARGET_IP}"
  else
    fail "${COMPOSE_FILE} missing extra_hosts auth.nacfson.cloud:${TARGET_IP}"
  fi
fi

# --- optional remote readyz (only if stack is up) ---
if [[ "$FAILS" -eq 0 ]] && ssh -o BatchMode=yes -o ConnectTimeout=5 "$DEPLOY_HOST_EXPECTED" 'true' 2>/dev/null; then
  if ssh -o BatchMode=yes -o ConnectTimeout=5 "$DEPLOY_HOST_EXPECTED" \
    'curl -fsS --connect-timeout 3 http://127.0.0.1:53412/readyz' >/tmp/cutover-wlubuntu-readyz.out 2>/dev/null; then
    ok "remote http://127.0.0.1:53412/readyz → $(tr -d '\n' </tmp/cutover-wlubuntu-readyz.out)"
  else
    warn "PN stack /readyz not reachable yet on ${DEPLOY_HOST_EXPECTED}:53412 (expected before first deploy)"
  fi
  rm -f /tmp/cutover-wlubuntu-readyz.out
fi

# --- remaining manual steps ---
cat <<EOF

${PREFIX} Remaining manual steps (human on home LAN Mac):
  1. ProcessManager K8s bootstrap on wlUbuntu
       CONTROL_PLANE_IP=${TARGET_IP}
       scripts: bootstrap-common.sh → bootstrap-control-plane.sh → install-addons.sh
       (sudo password for nacfson)
  2. Retarget ProcessManager REGISTRY to ${REGISTRY}; Mac Docker insecure-registries += ${REGISTRY}
  3. deploy-auth.sh + bootstrap admin from k8s/auth/bootstrap-secret.yaml
  4. TLS: ~/project-pn/deploy/certs/{fullchain,privkey}.pem on wlUbuntu
  5. scripts/deploy-remote.sh (DEPLOY_HOST=${DEPLOY_HOST_EXPECTED})
  6. LAN DNS: auth/pn/manager.nacfson.cloud → ${TARGET_IP}
  7. Router: WAN 80,443,53412 → ${TARGET_IP} (public DNS WAN 124.59.225.59 unchanged)
  8. Smoke: LAN + cellular https://pn.nacfson.cloud/readyz and auth login

See: deploy/migrate-to-wlubuntu.md
EOF

if [[ "$FAILS" -gt 0 ]]; then
  log "preflight FAILED (${FAILS} check(s))"
  exit 1
fi

log "preflight PASSED (manual network/auth steps still required)"
exit 0

#!/usr/bin/env bash
# Triggered by Antigravity PreToolUse hook for run_command.
# Reads the proposed command from stdin.

set -euo pipefail

# Read proposed command from stdin
PROPOSED_CMD=$(cat)

# Check if the command involves remote deployment
if [[ "$PROPOSED_CMD" != *"deploy-remote.sh"* ]]; then
  # Not a deploy command, exit successfully
  exit 0
fi

# It is a deploy command! Run the doc sync.
if [[ -f "deploy/.deploy.env" ]]; then
  source deploy/.deploy.env
fi

if [[ -z "${DEPLOY_HOST:-}" ]]; then
  echo "[sync-docs-hook] DEPLOY_HOST is not set, skipping remote doc sync"
  exit 0
fi

REMOTE_DIR="${REMOTE_DIR:-~/project-pn/deploy}"

echo "[sync-docs-hook] Antigravity hook: Syncing documentation to ${DEPLOY_HOST}:${REMOTE_DIR}/docs..."

# Create remote directories
ssh "$DEPLOY_HOST" "mkdir -p ${REMOTE_DIR}/docs ${REMOTE_DIR}/docs/backend ${REMOTE_DIR}/docs/frontend"

# Upload docs
scp -r docs/. "$DEPLOY_HOST:${REMOTE_DIR}/docs/"
scp -r backend/docs/. "$DEPLOY_HOST:${REMOTE_DIR}/docs/backend/"
scp -r frontend/docs/. "$DEPLOY_HOST:${REMOTE_DIR}/docs/frontend/"
scp deploy/*.md "$DEPLOY_HOST:${REMOTE_DIR}/docs/"

echo "[sync-docs-hook] Documentation successfully synced!"

#!/usr/bin/env bash
# Start a Cursor My Machines worker for this repo (local deploy + dev tools).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKER_NAME="${CURSOR_WORKER_NAME:-project-pn-mac}"

if ! command -v agent >/dev/null 2>&1; then
  echo "agent CLI not found; install Cursor agent CLI" >&2
  exit 1
fi

echo "Starting Cursor worker '${WORKER_NAME}' with worker-dir=${REPO_ROOT}"
echo "Keep this process running (or use deploy/cursor-worker.launchd.plist.example with launchd)."
echo "Verify machine at https://cursor.com/agents"
exec agent worker start \
  --name "$WORKER_NAME" \
  --worker-dir "$REPO_ROOT"

#!/usr/bin/env bash
# This script updates the remote .env file on wlUbuntu for the domain pn.nacfson.cloud.
set -euo pipefail

log() {
  printf '[env-update] %s\n' "$*"
}

log "Updating remote .env on wlUbuntu..."
ssh wlUbuntu 'bash -s' << 'EOF'
set -eu
cd ~/project-pn/deploy
if [ ! -f .env ]; then
  echo "ERROR: ~/project-pn/deploy/.env not found on the server" >&2
  exit 1
fi
sed -i 's|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://pn.nacfson.cloud,http://124.59.225.59:53412,http://192.168.219.120:53412,http://192.168.219.109:53412,http://localhost:8081,tauri://localhost,http://tauri.localhost|' .env
sed -i 's|^APP_PUBLIC_URL=.*|APP_PUBLIC_URL=https://pn.nacfson.cloud|' .env
sed -i 's|^WEB_APP_PUBLIC_URL=.*|WEB_APP_PUBLIC_URL=https://pn.nacfson.cloud|' .env
echo "Remote .env updated successfully!"
EOF

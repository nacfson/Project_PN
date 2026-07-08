#!/usr/bin/env bash
# This script runs on zlUbuntu to automate Certbot SSL certificate acquisition.
set -euo pipefail

log() {
  printf '[ssl-setup] %s\n' "$*"
}

log "Updating package list..."
sudo apt-get update -y

log "Checking if certbot is installed..."
if ! command -v certbot >/dev/null 2>&1; then
  log "Installing certbot..."
  sudo apt-get install -y certbot
else
  log "certbot is already installed."
fi

# Track what we stop to restart later
stopped_system_nginx=false
stopped_system_apache=false
stopped_host_nginx=false
stopped_docker_containers=()

# 1. Stop system-wide services if active under systemd
if systemctl is-active --quiet nginx 2>/dev/null; then
  log "System-wide nginx is active in systemd. Stopping it..."
  sudo systemctl stop nginx
  stopped_system_nginx=true
fi

if systemctl is-active --quiet apache2 2>/dev/null; then
  log "System-wide apache2 is active in systemd. Stopping it..."
  sudo systemctl stop apache2
  stopped_system_apache=true
fi

# 2. Stop project-pn staging nginx container
log "Stopping project-pn staging docker nginx container..."
cd ~/project-pn/deploy
docker compose stop nginx || true

# 3. Deep scan port 80 to identify and stop any conflicting process
log "Scanning for any remaining processes on port 80..."
conflicting_pids=$(sudo ss -tulpn | grep :80 | grep -o -E 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)

if [[ -z "$conflicting_pids" ]] && command -v lsof >/dev/null 2>&1; then
  conflicting_pids=$(sudo lsof -t -i :80 || true)
fi

if [[ -n "$conflicting_pids" ]]; then
  for pid in $conflicting_pids; do
    log "Inspecting process PID $pid..."
    
    # Check if this PID belongs to any running Docker container
    belongs_to_container=""
    all_containers=$(docker ps -q || true)
    for cid in $all_containers; do
      cpid=$(docker inspect --format '{{.State.Pid}}' "$cid" 2>/dev/null || true)
      if [[ "$cpid" == "$pid" ]]; then
        container_name=$(docker inspect --format '{{.Name}}' "$cid" 2>/dev/null | sed 's/^\///' || true)
        log "PID $pid belongs to Docker container: $container_name (ID: $cid). Stopping it..."
        docker stop "$cid"
        stopped_docker_containers+=("$cid")
        belongs_to_container="true"
        break
      fi
    done
    
    # If not a docker container, handle as a host process
    if [[ -z "$belongs_to_container" ]]; then
      cmdline=$(cat "/proc/$pid/cmdline" 2>/dev/null | tr '\0' ' ' || true)
      log "PID $pid is a host process: $cmdline"
      if [[ "$cmdline" == *nginx* ]]; then
        log "Stopping host-level nginx process..."
        sudo nginx -s stop 2>/dev/null || sudo kill -9 "$pid" || true
        stopped_host_nginx=true
      else
        log "Killing conflicting process PID $pid..."
        sudo kill -9 "$pid" || true
      fi
    fi
  done
fi

log "Double-checking port 80 availability..."
if command -v ss >/dev/null 2>&1; then
  sudo ss -tulpn | grep :80 || log "Port 80 is free in ss check."
elif command -v netstat >/dev/null 2>&1; then
  sudo netstat -tpln | grep :80 || log "Port 80 is free in netstat check."
fi

log "Requesting SSL certificate for pn.nacfson.cloud..."
# Runs certbot in standalone mode non-interactively
sudo certbot certonly --standalone \
  -d pn.nacfson.cloud \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email

log "Copying certificates to project deployment directory..."
mkdir -p ~/project-pn/deploy/certs
sudo cp /etc/letsencrypt/live/pn.nacfson.cloud/fullchain.pem ~/project-pn/deploy/certs/
sudo cp /etc/letsencrypt/live/pn.nacfson.cloud/privkey.pem ~/project-pn/deploy/certs/

log "Setting correct permissions..."
sudo chown -R "$USER:$USER" ~/project-pn/deploy/certs
chmod 644 ~/project-pn/deploy/certs/*.pem

# 5. Restart services
log "Restarting project-pn staging docker nginx container..."
docker compose up -d nginx

# Restart other stopped docker containers
if [ "${#stopped_docker_containers[@]}" -gt 0 ]; then
  for container_id in "${stopped_docker_containers[@]}"; do
    log "Restarting stopped container (ID: $container_id)..."
    docker start "$container_id"
  done
fi

if [ "$stopped_host_nginx" = true ]; then
  log "Restarting host-level nginx..."
  sudo nginx 2>/dev/null || true
fi

if [ "$stopped_system_nginx" = true ]; then
  log "Restarting system-wide nginx..."
  sudo systemctl start nginx
fi

if [ "$stopped_system_apache" = true ]; then
  log "Restarting system-wide apache2..."
  sudo systemctl start apache2
fi

log "Verification check:"
docker compose ps nginx

log "SSL certificate setup complete successfully!"

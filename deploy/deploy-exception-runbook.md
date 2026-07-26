# Project PN Deploy Exception Runbook

Common failures when deploying or running Project PN on `wlUbuntu`, with causes
and fixes.

Run all server-side commands via SSH:

```sh
ssh wlUbuntu
cd ~/project-pn/deploy
```

---

## `curl localhost:53412` fails on local Mac

**Cause:** You are running curl on the Mac. `localhost` means the Mac itself,
not the remote server.

**Fix:** Use the server IP:

```sh
# Same LAN
curl http://192.168.219.120:53412/healthz

# Public internet
curl http://124.59.225.59:53412/healthz
```

To test directly on the server:

```sh
ssh wlUbuntu 'curl http://localhost:53412/healthz'
```

---

## Connection refused on public IP

**Cause 1:** The router is not forwarding WAN port `53412` to `wlUbuntu`.
If the router UI shows an internal/private port range, it must also be
`53412-53412`; do not leave it as `22-22`, which forwards the public request to
SSH instead of Project PN.

**Cause 2:** You are testing from inside the same LAN. Some home routers
(including LG U+ CHGW units) do not support NAT hairpin/loopback, so a request
to the WAN IP from an internal host is dropped by the router even though the
port-forward rule is correct and works for real external users.

**Fix for Cause 1:** Add or verify the router port-forward rule:

```text
Protocol:              TCP
External/WAN port:     53412-53412
Internal/LAN IP:       192.168.219.120
Internal/private port: 53412-53412
Status:                ON / enabled
```

**Fix for Cause 2:** Test from a genuinely external network (mobile hotspot,
another location, or an external service):

```sh
curl http://124.59.225.59:53412/healthz
```

If it works from outside but fails from inside the LAN, the rule is correct and
the router simply lacks NAT hairpin support. Do **not** bake a second LAN API URL
into the phone app (that causes sequential fallback delays off Wi‑Fi).

**Preferred fix for Cause 2 (intranet + single client URL):** use LAN split DNS
so `pn.nacfson.cloud` resolves to `192.168.219.120` on home Wi‑Fi and to the
public IP on the internet. Native builds use only
`EXPO_PUBLIC_API_BASE_URL=https://pn.nacfson.cloud`. See
`deploy/NETWORK_SETUP.md` (Frontend Base URLs → Intranet via split DNS).

For ad-hoc local testing only, you may still curl the LAN IP directly:

```sh
curl http://192.168.219.120:53412/healthz
```

If `http://124.59.225.59/` shows a router admin page such as
`/etc/intro.asp`, public port `80` is still terminating at the router. Use the
custom staging port `53412` and make sure the forwarding rule targets
`192.168.219.120:53412`.

---

## iOS app shows `All API endpoints failed: http://localhost:8080`

**Cause:** The JS bundle baked `localhost:8080`. Common when building from Xcode
without `NODE_ENV=production` (Expo then loads only `.env.local` / `.env`) or when
`.env.local` / an empty `.env.production.local` overrides the production URL.

**Fix:**

1. Confirm `frontend/ios/.xcode.env` exports `NODE_ENV=production` and
   `EXPO_PUBLIC_API_BASE_URL=https://pn.nacfson.cloud`.
2. Do not set `EXPO_PUBLIC_API_BASE_URL=` (empty) in `.env.production.local`.
3. Use Xcode scheme **Release** on a physical device; Clean Build Folder; delete
   the old app; Run again.
4. Verify the embedded bundle (see `deploy/NETWORK_SETUP.md` → Build iOS from Xcode).

Debug + Metro on a physical phone must not use `http://localhost:8080` in
`.env.local` — that host is the phone itself.

---

## CORS error in browser

**Cause:** The frontend origin is not in the backend `ALLOWED_ORIGINS`.

**Fix:** Edit the remote `.env` and restart the API:

```sh
ssh wlUbuntu
cd ~/project-pn/deploy
grep ALLOWED_ORIGINS .env
```

Expected for intranet + public access + Tauri desktop:

```env
ALLOWED_ORIGINS=http://124.59.225.59:53412,http://192.168.219.120:53412,https://pn.nacfson.cloud,http://localhost:8081,tauri://localhost,http://tauri.localhost
```

If it is wrong, update it and restart:

```sh
# Use sed or a text editor
sed -i 's|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://124.59.225.59:53412,http://192.168.219.120:53412,https://pn.nacfson.cloud,http://localhost:8081,tauri://localhost,http://tauri.localhost|' .env
docker compose up -d --no-deps api nginx
```

---

## 502 Bad Gateway from nginx

**Cause:** The `api` container is down, unhealthy, or crashed.

**Fix:** Check logs and status:

```sh
ssh wlUbuntu
cd ~/project-pn/deploy
docker compose ps
docker compose logs --tail 100 api
```

Common causes:

- PostgreSQL not healthy → `docker compose logs postgres`
- Migration failed → `docker compose logs migrate`
- Missing env var → `docker compose config | grep -A2 'APP_PUBLIC_URL\|WEB_APP_PUBLIC_URL'`

Restart everything:

```sh
docker compose down
docker compose up -d
```

---

## Migration password authentication failed

**Cause:** The Postgres volume already exists with an older password, but the
new `.env` has a different `POSTGRES_PASSWORD`.

**Fix:** Set the old password locally and rerun deploy:

```sh
# On your Mac, in /Users/hyungjuyu/Projects/iOS/Project_PN
EXISTING_POSTGRES_PASSWORD=<old-password> scripts/deploy-remote.sh
```

If you do not know the old password and the data is disposable, remove the
volume (destructive):

```sh
ssh wlUbuntu
cd ~/project-pn/deploy
docker compose down -v
docker compose up -d
```

---

## `frontend/dist` missing or stale

**Cause:** The deploy script did not run the frontend build, or the local bundle
is outdated.

**Fix:** Build manually and verify timestamps:

```sh
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
EXPO_PUBLIC_API_BASE_URL= npm run web:export
ls -la dist/index.html
```

Then redeploy or upload:

```sh
scp -r frontend/dist/. wlUbuntu:~/project-pn/deploy/web/
ssh wlUbuntu 'cd ~/project-pn/deploy && docker compose up -d --force-recreate nginx'
```

---

## TLS / certificate errors on HTTPS (`ERR_CERT_AUTHORITY_INVALID`)

**Production HTTPS** is served by **ingress-nginx** on wlUbuntu `:443` with
Let's Encrypt secrets (`pn-tls` / `auth-service-tls`). Compose `:53412` is HTTP
staging only.

| Symptom | Likely cause |
|---|---|
| Issuer `Kubernetes Ingress Controller Fake Certificate` | No Ingress TLS secret for that host, or ingress not synced |
| Issuer is self-signed / `ERR_CERT_AUTHORITY_INVALID` | cert-manager recreated self-signed over LE; delete `Certificate` and restore LE secret |
| Redirect loop on `https://pn.nacfson.cloud` | Compose nginx redirected to HTTPS without honoring `X-Forwarded-Proto` |
| WAN `http://124.59.225.59/` shows router `intro.asp` | Port 80 not forwarded to `192.168.219.120` |

**Check live cert:**

```sh
echo | openssl s_client -connect 192.168.219.120:443 -servername pn.nacfson.cloud 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates
# Expect: issuer=... O=Let's Encrypt ...
```

**Restore LE secrets from acme.sh (on wlUbuntu as root):**

```sh
export KUBECONFIG=/etc/kubernetes/admin.conf
CERT_DIR=/root/.acme.sh/pn.nacfson.cloud
kubectl -n nacfson-auth delete certificate auth-service-tls --ignore-not-found
kubectl -n project-pn create secret tls pn-tls \
  --cert="$CERT_DIR/fullchain.cer" --key="$CERT_DIR/pn.nacfson.cloud.key" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n nacfson-auth create secret tls auth-service-tls \
  --cert="$CERT_DIR/fullchain.cer" --key="$CERT_DIR/pn.nacfson.cloud.key" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n ingress-nginx rollout restart deploy/ingress-nginx-controller
```

**Re-issue (needs free host `:443`; scales ingress down temporarily):**

```sh
acme.sh --issue --alpn -d pn.nacfson.cloud -d auth.nacfson.cloud --force
bash /root/acme-reload-hook.sh
```

For HTTP-only staging without TLS, use `http://192.168.219.120:53412`.

---

## Old bundle still served after deploy

**Cause:** nginx cached the old files or the new bundle was not uploaded.

**Fix:** Force recreate the nginx container:

```sh
ssh wlUbuntu
cd ~/project-pn/deploy
docker compose up -d --force-recreate nginx
ls -la web/index.html
```

---

## Magic link redirects to wrong URL

**Cause:** `APP_PUBLIC_URL` or `WEB_APP_PUBLIC_URL` in remote `.env` does not match the URL users open.

**Fix:** Update and restart API:

```sh
ssh wlUbuntu
cd ~/project-pn/deploy
grep -E 'APP_PUBLIC_URL|WEB_APP_PUBLIC_URL' .env
```

For staging:

```env
APP_PUBLIC_URL=https://pn.nacfson.cloud
```

Then:

```sh
docker compose up -d --no-deps api
```

---

## Container does not restart after reboot

**Cause:** Docker Compose services may not start automatically unless configured.

**Fix:** The current `compose.yaml` uses `restart: unless-stopped`, which restarts
after a Docker daemon restart. If the host reboots, start manually:

```sh
ssh wlUbuntu
cd ~/project-pn/deploy
docker compose up -d
```

For automatic host-level restart, add a systemd service or cron `@reboot` entry.

---

## Port 80 occupied by host-level nginx or host-networked containers during SSL setup

**Cause:** Nginx processes running on the host system or in other Docker containers using `network_mode: host` are occupying port 80. Standard `docker compose stop` or systemd service checks will not free port 80, preventing Certbot from binding to it.

**Fix:** Identify the conflicting PIDs using `ss` or `lsof` and map them to their corresponding Docker container (or stop/kill them if they are host processes):

1. Find the host PIDs listening on port 80:
   ```bash
   sudo ss -tulpn | grep :80
   ```
2. Check if a PID belongs to a Docker container by querying container PIDs:
   ```bash
   docker ps -q | xargs docker inspect --format '{{.State.Pid}} {{.Name}}'
   ```
3. If it belongs to a container, stop it:
   ```bash
   docker stop <container_id>
   ```
4. If it is a host process (e.g. standalone host nginx), stop or kill it:
   ```bash
   sudo nginx -s stop || sudo kill -9 <pid>
   ```
5. Run Certbot and restart the services afterwards.

A helper script automating this is located at `scripts/setup-ssl.sh`.

---

## Useful Debug Commands

```sh
# All containers
docker compose ps

# Recent logs across all services
docker compose logs --tail 200

# API logs only
docker compose logs --tail 200 api

# Inspect running API env
docker compose exec api env | sort

# Test backend directly, bypassing nginx
curl http://api:8080/healthz

# Test from inside nginx container
docker compose exec nginx wget -qO- http://api:8080/healthz
```

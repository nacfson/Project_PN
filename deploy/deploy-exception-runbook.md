# Project PN Deploy Exception Runbook

Common failures when deploying or running Project PN on `zlUbuntu`, with causes
and fixes.

Run all server-side commands via SSH:

```sh
ssh zlUbuntu
cd ~/project-pn/deploy
```

---

## `curl localhost:53412` fails on local Mac

**Cause:** You are running curl on the Mac. `localhost` means the Mac itself,
not the remote server.

**Fix:** Use the server IP:

```sh
# Same LAN
curl http://192.168.219.100:53412/healthz
curl http://192.168.219.109:53412/healthz

# Public internet
curl http://124.59.225.59:53412/healthz
```

To test directly on the server:

```sh
ssh zlUbuntu 'curl http://localhost:53412/healthz'
```

---

## Connection refused on public IP

**Cause 1:** The router is not forwarding WAN port `53412` to `zlUbuntu`.
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
Internal/LAN IP:       192.168.219.100
Internal/private port: 53412-53412
Status:                ON / enabled
```

**Fix for Cause 2:** Test from a genuinely external network (mobile hotspot,
another location, or an external service):

```sh
curl http://124.59.225.59:53412/healthz
```

If it works from outside but fails from inside the LAN, the rule is correct and
the router simply lacks NAT hairpin support. Continue using the public IP for
external access and use the LAN IP or the Cloudflare tunnel for local testing.

If `http://124.59.225.59/` shows a router admin page such as
`/etc/intro.asp`, public port `80` is still terminating at the router. Use the
custom staging port `53412` and make sure the forwarding rule targets
`192.168.219.100:53412`.

---

## CORS error in browser

**Cause:** The frontend origin is not in the backend `ALLOWED_ORIGINS`.

**Fix:** Edit the remote `.env` and restart the API:

```sh
ssh zlUbuntu
cd ~/project-pn/deploy
grep ALLOWED_ORIGINS .env
```

Expected for intranet + public access + Tauri desktop:

```env
ALLOWED_ORIGINS=http://124.59.225.59:53412,http://192.168.219.100:53412,http://192.168.219.109:53412,http://localhost:8081,tauri://localhost,http://tauri.localhost
```

If it is wrong, update it and restart:

```sh
# Use sed or a text editor
sed -i 's|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://124.59.225.59:53412,http://192.168.219.100:53412,http://192.168.219.109:53412,http://localhost:8081,tauri://localhost,http://tauri.localhost|' .env
docker compose up -d --no-deps api nginx
```

---

## 502 Bad Gateway from nginx

**Cause:** The `api` container is down, unhealthy, or crashed.

**Fix:** Check logs and status:

```sh
ssh zlUbuntu
cd ~/project-pn/deploy
docker compose ps
docker compose logs --tail 100 api
```

Common causes:

- PostgreSQL not healthy → `docker compose logs postgres`
- Migration failed → `docker compose logs migrate`
- Missing env var → `docker compose config | grep -A2 APP_PUBLIC_URL`

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
ssh zlUbuntu
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
scp -r frontend/dist/. zlUbuntu:~/project-pn/deploy/web/
ssh zlUbuntu 'cd ~/project-pn/deploy && docker compose up -d --force-recreate nginx'
```

---

## TLS / certificate errors on HTTPS

**Cause:** nginx port 443 needs `certs/fullchain.pem` and `certs/privkey.pem`.

**Fix:** On `zlUbuntu`:

```sh
cd ~/project-pn/deploy
ls -la certs/
```

If missing, obtain or copy certificates into `deploy/certs/` and restart nginx:

```sh
docker compose up -d --force-recreate nginx
```

For staging over HTTP, use port `53412` instead of `443`.

---

## Old bundle still served after deploy

**Cause:** nginx cached the old files or the new bundle was not uploaded.

**Fix:** Force recreate the nginx container:

```sh
ssh zlUbuntu
cd ~/project-pn/deploy
docker compose up -d --force-recreate nginx
ls -la web/index.html
```

---

## Magic link redirects to wrong URL

**Cause:** `APP_PUBLIC_URL` in remote `.env` does not match the URL users open.

**Fix:** Update and restart API:

```sh
ssh zlUbuntu
cd ~/project-pn/deploy
grep APP_PUBLIC_URL .env
```

For staging:

```env
APP_PUBLIC_URL=http://124.59.225.59:53412
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
ssh zlUbuntu
cd ~/project-pn/deploy
docker compose up -d
```

For automatic host-level restart, add a systemd service or cron `@reboot` entry.

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

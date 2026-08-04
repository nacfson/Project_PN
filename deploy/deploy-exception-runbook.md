# Project PN Deploy Exception Runbook

Common failures when deploying or running Project PN on the **Oracle Cloud**
Ubuntu instance, with causes and fixes.

Run all server-side commands via SSH:

```sh
ssh OracleCloud
cd ~/project-pn/deploy
```

See also [`NETWORK_SETUP.md`](NETWORK_SETUP.md) for OCI security lists / NSG ports.

---

## `curl localhost:53412` fails on local Mac

**Cause:** You are running curl on the Mac. `localhost` means the Mac itself,
not the remote server.

**Fix:** Use the Oracle Cloud public IP or domain:

```sh
curl https://YOUR_PUBLIC_DOMAIN/healthz
# or HTTP staging:
curl http://YOUR_ORACLE_PUBLIC_IP:53412/healthz
```

To test directly on the server:

```sh
ssh OracleCloud 'curl -s http://localhost:53412/healthz'
# or
ssh OracleCloud 'curl -s http://localhost/healthz'
```

---

## Connection refused on public IP

**Cause 1:** OCI Security List / NSG does not allow inbound TCP on the port you
are using (`80`, `443`, and/or `53412`).

**Cause 2:** The instance has no public IP, or the subnet has no Internet Gateway
route.

**Cause 3:** nginx/compose is not listening on the host port.

**Fix for Cause 1:** In OCI Console → VCN → Security List / NSG, add ingress:

```text
TCP 22
TCP 80
TCP 443
TCP 53412   # optional staging
Source CIDR: 0.0.0.0/0   # or your admin CIDR
```

**Fix for Cause 2:** Attach a public IP to the VNIC and ensure the subnet route
table sends `0.0.0.0/0` to an Internet Gateway.

**Fix for Cause 3:** On the server:

```sh
ssh OracleCloud
cd ~/project-pn/deploy
docker compose --env-file .env ps
docker compose --env-file .env logs --no-color nginx api
ss -lntp | rg '80|443|53412'
```

---

## CORS error in browser

**Cause:** The frontend origin is not in the backend `ALLOWED_ORIGINS`.

**Fix:** Edit the remote `.env` and restart the API:

```sh
ssh OracleCloud
cd ~/project-pn/deploy
grep ALLOWED_ORIGINS .env
```

Expected for public Oracle Cloud + local Expo/Tauri:

```env
ALLOWED_ORIGINS=https://YOUR_PUBLIC_DOMAIN,http://localhost:8081,tauri://localhost,http://tauri.localhost
```

HTTP staging example:

```env
ALLOWED_ORIGINS=http://YOUR_ORACLE_PUBLIC_IP:53412,http://localhost:8081,tauri://localhost,http://tauri.localhost
```

If it is wrong, update it and restart:

```sh
# Use sed or a text editor — replace with your real origin(s)
sed -i 's|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://YOUR_PUBLIC_DOMAIN,http://localhost:8081,tauri://localhost,http://tauri.localhost|' .env
docker compose up -d --no-deps api nginx
```

---

## Migration password failed

**Cause:** Remote Postgres volume was initialized with a different
`POSTGRES_PASSWORD` than the one in `.env`.

**Fix:** Set the old password in local `deploy/.deploy.env` and redeploy:

```env
EXISTING_POSTGRES_PASSWORD=old-password
```

Then:

```sh
scripts/deploy-remote.sh
```

Inspect migrate logs:

```sh
ssh OracleCloud 'cd ~/project-pn/deploy && docker compose --env-file .env logs --no-color migrate'
```

---

## 502 Bad Gateway from nginx

**Cause:** API container is down, restarting, or not healthy.

**Fix:**

```sh
ssh OracleCloud
cd ~/project-pn/deploy
docker compose --env-file .env ps
docker compose --env-file .env logs --no-color api
docker compose --env-file .env up -d --force-recreate api
curl -s http://127.0.0.1:8080/readyz || curl -s http://127.0.0.1/readyz
```

---

## Old web bundle still shown

**Cause:** Browser cache or nginx not reloading uploaded files.

**Fix:**

```sh
# From Mac (after web:export)
scp -r frontend/dist/. OracleCloud:~/project-pn/deploy/web/
ssh OracleCloud 'cd ~/project-pn/deploy && docker compose up -d --force-recreate nginx'
```

Hard-refresh the browser (or clear site cache).

---

## Central auth / enrichment outbound failures

**Cause:** Oracle Cloud egress blocked, or `deploy/compose.yaml` still pins
`auth.nacfson.cloud` to an old home-LAN IP via `extra_hosts`.

**Fix:**

1. Remove home-LAN `extra_hosts` overrides for `auth.nacfson.cloud` on Oracle Cloud.
2. Confirm the instance can reach the public internet (`curl -I https://auth.nacfson.cloud`).
3. Restart API after compose changes.

---

## Magic link / OAuth redirect wrong

**Cause:** `APP_PUBLIC_URL` in remote `.env` does not match the URL users open.

**Fix:**

```sh
ssh OracleCloud
cd ~/project-pn/deploy
grep APP_PUBLIC_URL .env
# set to https://YOUR_PUBLIC_DOMAIN (or the staging URL users actually use)
docker compose up -d --no-deps api
```

---

## Deploy script cannot resolve host

**Cause:** `DEPLOY_HOST` in `deploy/.deploy.env` is not a valid SSH alias.

**Fix:** Use the Oracle Cloud SSH alias:

```env
DEPLOY_HOST=OracleCloud
```

and ensure `~/.ssh/config` has:

```sshconfig
Host OracleCloud
  HostName YOUR_ORACLE_PUBLIC_IP
  User ubuntu
  IdentityFile ~/.ssh/your_oci_key
```

---

## Quick checks

```sh
ssh OracleCloud 'cd ~/project-pn/deploy && docker compose --env-file .env ps'
ssh OracleCloud 'curl -s http://localhost:53412/readyz || curl -s http://localhost/readyz'
curl -s https://YOUR_PUBLIC_DOMAIN/readyz
```

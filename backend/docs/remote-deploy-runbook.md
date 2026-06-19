# Remote Deploy Runbook

This project deploys the backend without GHCR. The deploy script builds the backend Docker image locally, uploads it to the server over SSH/SCP, loads it with Docker, and starts the remote Docker Compose stack.

## Prerequisites

Local Mac:

```sh
docker --version
docker compose version
ssh -V
command -v scp
git --version
gzip --version
```

Remote Ubuntu server:

```sh
ssh YOUR_SSH_ALIAS
docker --version
docker compose version
```

The SSH user must be able to run Docker. For public access from outside the intranet, router port-forward public `80/tcp` and `443/tcp` to `zlUbuntu`, and use HTTPS with real certificate files.

## Local Deploy Config

Create the ignored local config file:

```sh
cp deploy/.deploy.env.example deploy/.deploy.env
```

Example:

```env
DEPLOY_HOST=zlUbuntu
DEPLOY_PUBLIC_URL=https://YOUR_PUBLIC_DOMAIN
DEPLOY_ACCESS_SCOPE=public
REMOTE_DIR='~/project-pn/deploy'
IMAGE_NAME=project-pn-backend
PLATFORM=linux/amd64
```

Use the exact `Host` alias from `~/.ssh/config` for `DEPLOY_HOST`.

For access outside your intranet, deploy to a server with a public IP/domain and set:

```env
DEPLOY_PUBLIC_URL=https://YOUR_PUBLIC_DOMAIN
DEPLOY_ACCESS_SCOPE=public
```

`DEPLOY_ACCESS_SCOPE=public` refuses `localhost`, `127.0.0.1`, `10.x.x.x`,
`172.16.x.x`-`172.31.x.x`, and `192.168.x.x` URLs because those are not
reachable from the public internet.

If the server is behind a home/office router and the public IP shows the router
admin page instead of Project PN, inbound traffic is not being forwarded to the
Ubuntu host. Fix that with one of these durable options:

- move the stack to a public cloud host
- configure router/NAT port-forwarding for both `80/tcp` and `443/tcp` to the
  Ubuntu host (`zlUbuntu`)
- run a named Cloudflare Tunnel on a domain you control

For temporary outside-intranet testing only, you can use a Cloudflare
TryCloudflare quick tunnel. Cloudflare quick tunnels create a random
`trycloudflare.com` URL and proxy it back to a localhost web server, but
Cloudflare documents them as testing/development only, not production.

```sh
QUICK_TUNNEL_ACK=public-test-only scripts/start-remote-quick-tunnel.sh
```

To also update the remote `.env` so magic-link redirects use the temporary URL
and CORS allows it, run:

```sh
QUICK_TUNNEL_ACK=public-test-only UPDATE_REMOTE_ENV=true scripts/start-remote-quick-tunnel.sh
```

The helper writes `cloudflared.pid` and `cloudflared.log` in the remote deploy
directory. Check or stop the temporary tunnel with:

```sh
QUICK_TUNNEL_ACTION=status scripts/start-remote-quick-tunnel.sh
QUICK_TUNNEL_ACTION=stop scripts/start-remote-quick-tunnel.sh
```

If a remote Postgres volume already exists and was initialized with an older password, add the old password locally:

```env
EXISTING_POSTGRES_PASSWORD=change_me_staging
```

Do not commit `deploy/.deploy.env`; it is ignored by git.

## Deploy

Run from repo root:

```sh
scripts/deploy-remote.sh
```

The script:

- builds `project-pn-backend:<git-short-sha>` for `linux/amd64`
- also tags `project-pn-backend:latest`
- saves a compressed image tarball
- uploads `deploy/compose.yaml`, `deploy/.env.example`, `deploy/nginx/nginx.conf`, and the tarball
- runs `docker load` on the server
- creates remote `.env` when missing
- preserves any existing remote `.env`
- optionally rotates an existing Postgres user password when `EXISTING_POSTGRES_PASSWORD` is set
- requires `certs/fullchain.pem` and `certs/privkey.pem` on the remote server before nginx starts
- runs `docker compose --env-file .env up -d`
- checks `http://127.0.0.1/readyz`

Successful output ends with:

```text
{"status":"ready"}
[deploy] deployed project-pn-backend:<git-short-sha>
```

## Remote Files

The server deploy directory contains:

```text
~/project-pn/deploy/compose.yaml
~/project-pn/deploy/.env
~/project-pn/deploy/.env.example
~/project-pn/deploy/nginx/nginx.conf
~/project-pn/deploy/certs/fullchain.pem
~/project-pn/deploy/certs/privkey.pem
```

The generated remote `.env` includes a random `POSTGRES_PASSWORD`, matching `DATABASE_URL`, `ALLOWED_ORIGINS`, and `APP_PUBLIC_URL`.

## Verify

From local Mac:

```sh
ssh zlUbuntu 'cd ~/project-pn/deploy && docker compose --env-file .env ps'
curl https://YOUR_PUBLIC_DOMAIN/readyz
```

Expected service state:

```text
api        Up
nginx      Up, 0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
postgres   Up, healthy
```

## Common Failures

SSH alias typo:

```text
Could not resolve hostname
```

Fix `DEPLOY_HOST` in `deploy/.deploy.env`.

Remote path expanded on macOS:

```text
mkdir: Permission denied
```

Keep `REMOTE_DIR` quoted:

```env
REMOTE_DIR='~/project-pn/deploy'
```

Migration password error:

```text
password authentication failed for user "project_pn"
```

Set `EXISTING_POSTGRES_PASSWORD` in `deploy/.deploy.env` and rerun the script.

Inspect logs:

```sh
ssh zlUbuntu 'cd ~/project-pn/deploy && docker compose --env-file .env logs --no-color migrate'
ssh zlUbuntu 'cd ~/project-pn/deploy && docker compose --env-file .env logs --no-color api'
```

## Safety

- The script does not overwrite an existing remote `.env`.
- Do not delete Docker volumes unless the staging database is disposable.
- Do not print or commit generated `.env` secrets.

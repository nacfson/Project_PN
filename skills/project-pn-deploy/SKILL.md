---
name: project-pn-deploy
description: >-
  Deploy Project PN's Expo web frontend and Go backend to the remote Ubuntu
  server (zlUbuntu). Use when the user asks to deploy web/backend changes,
  publish the web build, update the server, or distribute the full stack.
---

# Deploy Project PN Web & Backend Stack

Deploys the Expo web bundle and the Go backend Docker image to `zlUbuntu` by
running `scripts/deploy-remote.sh` and verifying the result.

## Prerequisites

Confirm before deploying:

- [ ] You are on the local Mac with the repo at `/Users/hyungjuyu/Projects/iOS/Project_PN`.
- [ ] Docker Desktop is running.
- [ ] `zlUbuntu` is reachable via SSH alias in `~/.ssh/config`.
- [ ] `deploy/.deploy.env` exists and contains the correct values for
  `DEPLOY_HOST`, `DEPLOY_PUBLIC_URL`, `DEPLOY_ACCESS_SCOPE`, `REMOTE_DIR`,
  `IMAGE_NAME`, and `PLATFORM`.
- [ ] The remote `~/project-pn/deploy/.env` has the correct `ALLOWED_ORIGINS`
  and `APP_PUBLIC_URL`.
- [ ] For HTTPS deployments, TLS certs exist at
  `~/project-pn/deploy/certs/fullchain.pem` and `privkey.pem`.

## Pre-deploy checks

Work from the repo root:

```sh
cd /Users/hyungjuyu/Projects/iOS/Project_PN
```

Review what will be deployed:

```sh
git status
cat deploy/.deploy.env
```

Warn the user about uncommitted changes; do not deploy unrelated work unless
explicitly asked.

Verify required tools are available:

```sh
command -v docker && command -v git && command -v ssh && \
  command -v scp && command -v npm && command -v curl
```

## Deploy

Run the deploy script:

```sh
scripts/deploy-remote.sh
```

Expected final output:

- `deployed project-pn-backend:<sha>`
- `/readyz` returns `{"status":"ready"}`

If the script fails, stop and consult `deploy/deploy-exception-runbook.md`.

## Post-deploy verification

Check the remote stack directly:

```sh
ssh zlUbuntu '
  cd ~/project-pn/deploy &&
  docker compose ps &&
  curl -fsS http://localhost:53412/healthz &&
  curl -fsS http://localhost:53412/readyz
'
```

Check from the public internet and LAN:

```sh
curl -fsS http://124.59.225.59:53412/healthz
curl -fsS http://124.59.225.59:53412/ | head
curl -fsS http://192.168.219.100:53412/ | head
```

Expected results:

- `/healthz` → `{"status":"ok"}`
- `/` → HTML for the Expo web app
- `docker compose ps` shows `api`, `nginx`, and `postgres` healthy/up

If any check fails, follow `deploy/deploy-exception-runbook.md`.

## Quick Troubleshooting

| Symptom | First Check |
|---|---|
| `curl localhost:53412` fails on Mac | Use the server IP, not Mac `localhost` |
| Public IP connection refused | Router port-forward rule for `53412/tcp` |
| CORS error in browser | `ALLOWED_ORIGINS` in remote `.env` |
| 502 Bad Gateway | `docker compose logs api` on server |
| Migration password failed | `EXISTING_POSTGRES_PASSWORD` in `deploy/.deploy.env` |
| Old bundle still shown | Force recreate nginx: `docker compose up -d --force-recreate nginx` |
| Magic link wrong redirect | `APP_PUBLIC_URL` in remote `.env` |

For deeper diagnosis, read `deploy/deploy-exception-runbook.md`.

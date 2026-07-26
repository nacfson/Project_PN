---
name: project-pn-deploy
description: >-
  Deploy Project PN's Expo web frontend and Go backend to the remote Ubuntu
  server (wlUbuntu). Use when the user asks to deploy web/backend changes,
  publish the web build, update the server, or distribute the full stack.
---

# Deploy Project PN Web & Backend Stack

Deploys the Expo web bundle and the Go backend Docker image to `wlUbuntu` by
running `scripts/deploy-remote.sh` and verifying the result.

## Prerequisites

Confirm before deploying:

- [ ] You are on the local Mac with the repo at `/Users/hyungjuyu/Projects/Brain/Project_PN`.
- [ ] Docker Desktop is running.
- [ ] `wlUbuntu` is reachable via SSH alias in `~/.ssh/config`.
- [ ] `deploy/.deploy.env` exists and contains the correct values for
  `DEPLOY_HOST=wlUbuntu`, `DEPLOY_PUBLIC_URL=https://pn.nacfson.cloud`,
  `DEPLOY_ACCESS_SCOPE`, `REMOTE_DIR`, `IMAGE_NAME`, and `PLATFORM`.
- [ ] The remote `~/project-pn/deploy/.env` has `AUTH_MODE=central`,
  `CENTRAL_AUTH_URL`, `CENTRAL_AUTH_INTERNAL_URL`, `ALLOWED_ORIGINS`,
  and `APP_PUBLIC_URL=https://pn.nacfson.cloud`.
- [ ] Production HTTPS uses ingress Let's Encrypt secrets; Compose
  `deploy/certs/` is kept in sync by the acme reload hook.

## Pre-deploy checks

Work from the repo root:

```sh
cd /Users/hyungjuyu/Projects/Brain/Project_PN
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

### Important: invalidate Expo's Metro cache when `EXPO_PUBLIC_*` env vars change

Expo's Metro bundler caches the transformed source files, including inlined
`process.env.EXPO_PUBLIC_*` values. If you change auth mode, API URL, or any
other `EXPO_PUBLIC_*` variable and the deployed web app still behaves like the
old configuration, the bundle was built from a stale transform cache.

Before running `scripts/deploy-remote.sh`, force a clean frontend export:

```sh
cd /Users/hyungjuyu/Projects/Brain/Project_PN/frontend
npx expo export --platform web --clear
```

Then return to the repo root and run the deploy script. This ensures the new
`EXPO_PUBLIC_*` values are baked into the bundle.

## Post-deploy verification

Check the remote stack directly:

```sh
ssh wlUbuntu '
  cd ~/project-pn/deploy &&
  docker compose ps &&
  curl -fsS http://localhost:53412/healthz &&
  curl -fsS http://localhost:53412/readyz
'
```

Check from the LAN and public HTTPS:

```sh
curl -fsS http://192.168.219.120:53412/healthz
curl -fsS --resolve pn.nacfson.cloud:443:192.168.219.120 https://pn.nacfson.cloud/readyz
curl -fsS -o /dev/null -w '%{http_code}\n' --resolve auth.nacfson.cloud:443:192.168.219.120 https://auth.nacfson.cloud/login
```

Expected results:

- `/healthz` → `{"status":"ok"}`
- `https://pn.nacfson.cloud/readyz` → `{"status":"ready"}` with Let's Encrypt (not Fake Certificate)
- `docker compose ps` shows `api`, `nginx`, and `postgres` healthy/up

If any check fails, follow `deploy/deploy-exception-runbook.md`.

## Quick Troubleshooting

| Symptom | First Check |
|---|---|
| `curl localhost:53412` fails on Mac | Use `192.168.219.120:53412`, not Mac `localhost` |
| `ERR_CERT_AUTHORITY_INVALID` | LE secrets / ingress; see runbook TLS section |
| Public HTTPS connection refused | Router port-forward `443/tcp` to `.120` |
| CORS error in browser | `ALLOWED_ORIGINS` in remote `.env` |
| 502 Bad Gateway | `docker compose logs api` or ingress logs |
| Migration password failed | `EXISTING_POSTGRES_PASSWORD` in `deploy/.deploy.env` |
| Old bundle still shown | Force recreate nginx: `docker compose up -d --force-recreate nginx` |
| New `EXPO_PUBLIC_*` env vars ignored (e.g. auth mode still local) | Run `npx expo export --platform web --clear` before deploying |
| Magic link wrong redirect | `APP_PUBLIC_URL=https://pn.nacfson.cloud` in remote `.env` |

For deeper diagnosis, read `deploy/deploy-exception-runbook.md`.

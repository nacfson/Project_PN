---
name: deploy-web-ubuntu
description: >-
  Build and deploy the Project PN web app (Expo Web static bundle + Go backend)
  to the remote Ubuntu server (wlUbuntu). Use when the user asks to deploy the
  web app, build and deploy frontend, publish the web build, deploy to wlUbuntu,
  or update the Project PN website/server.
---

# Deploy Project PN Web to wlUbuntu

Builds the Expo web bundle and the Go backend Docker image locally, then uploads
both to `wlUbuntu` and starts the Docker Compose stack.

## Prerequisites

Before running the deploy, confirm:

- [ ] You are on the local Mac with the Project PN repo at `/Users/hyungjuyu/Projects/Brain/Project_PN`.
- [ ] Docker Desktop is running.
- [ ] `npm`, `git`, `ssh`, and `scp` are available.
- [ ] `wlUbuntu` is reachable via SSH alias in `~/.ssh/config`.
- [ ] `deploy/.deploy.env` exists and contains:
  ```env
  DEPLOY_HOST=wlUbuntu
  DEPLOY_PUBLIC_URL=https://pn.nacfson.cloud
  DEPLOY_ACCESS_SCOPE=public
  REMOTE_DIR='~/project-pn/deploy'
  IMAGE_NAME=project-pn-backend
  PLATFORM=linux/amd64
  ```
- [ ] The remote `~/project-pn/deploy/.env` has `AUTH_MODE=central`,
  `CENTRAL_AUTH_URL=https://auth.nacfson.cloud`,
  `CENTRAL_AUTH_INTERNAL_URL=http://192.168.219.120:31956`
  (auth-service **NodePort** — ClusterIP is not reachable from Compose on the host),
  `APP_PUBLIC_URL=https://pn.nacfson.cloud`, and matching `ALLOWED_ORIGINS`.
- [ ] Central auth is **magic-link only** (`https://auth.nacfson.cloud/login`).
- [ ] Production HTTPS is on ingress (`pn-tls` / `auth-service-tls` Let's Encrypt).
  Compose certs under `~/project-pn/deploy/certs/` stay in sync via acme reload hook.
- [ ] Ingress `project-pn` (ProcessManager `k8s/project-pn/compose-ingress.yaml`)
  proxies `pn.nacfson.cloud` → host `192.168.219.120:53412`.

## Deploy Workflow

Run every step from the repo root:

```sh
cd /Users/hyungjuyu/Projects/Brain/Project_PN
```

### 1. Review changes

```sh
git status
```

Stage and commit frontend/backend changes you intend to deploy. Do not deploy
uncommitted work unless you are testing.

### 2. Verify deploy config

```sh
cat deploy/.deploy.env
```

Confirm `DEPLOY_PUBLIC_URL` matches the address users will use:

- Production HTTPS domain: `https://pn.nacfson.cloud`
- Staging over HTTP custom port: `http://192.168.219.120:53412` (LAN only; set `DEPLOY_ACCESS_SCOPE=private` if needed)

### 3. Run the deploy

```sh
scripts/deploy-remote.sh
```

Expected output sequence:

1. `building project-pn-backend:<sha> for linux/amd64`
2. `building frontend web bundle`
3. `uploading compose files, web bundle, and image`
4. `loading image on remote server`
5. `starting remote compose stack ...`
6. `checking remote /readyz` → `{"status":"ready"}`
7. `deployed project-pn-backend:<sha>`

If any step fails, stop and consult `deploy/deploy-exception-runbook.md`.

### 4. Verify from the server

SSH into `wlUbuntu`:

```sh
ssh wlUbuntu
cd ~/project-pn/deploy
docker compose ps
curl http://localhost:53412/ | head
curl http://localhost:53412/healthz
```

Expected:

- `index.html` content from `/`
- `{"status":"ok"}` from `/healthz`

### 5. Verify from the intranet

From another device on the same LAN:

```sh
curl -fsS http://192.168.219.120:53412/healthz
curl -fsS --resolve pn.nacfson.cloud:443:192.168.219.120 https://pn.nacfson.cloud/readyz
curl -fsS -o /dev/null -w '%{http_code}\n' --resolve auth.nacfson.cloud:443:192.168.219.120 https://auth.nacfson.cloud/login
```

### 6. Verify from public internet

From outside the LAN (requires WAN `443` → `192.168.219.120`):

```sh
curl -fsS https://pn.nacfson.cloud/readyz
curl -fsS -o /dev/null -w '%{http_code}\n' https://auth.nacfson.cloud/login
```

### 7. Browser smoke test

Open `https://pn.nacfson.cloud` (central login via magic link on `auth.nacfson.cloud`):

1. Click Sign In → Nacfson Cloud login → enter email → open magic link.
2. Confirm redirect returns with `?token=` / session and PN loads.
3. Go to the Capture screen.
4. Paste text and tap a word.
5. Confirm `POST /api/words/lookup` succeeds.
6. Pick a sense and add it.
7. Confirm `POST /api/learning-items` succeeds and the chip shows "added".

## How the Build Works

`scripts/deploy-remote.sh` builds the frontend with:

```sh
cd frontend
npm install
EXPO_PUBLIC_API_BASE_URL= npm run web:export
```

`EXPO_PUBLIC_API_BASE_URL` is intentionally **empty** so the exported bundle
resolves API calls from `window.location.origin`. The same bundle works on
`https://pn.nacfson.cloud` and staging `http://192.168.219.120:53412`.

The bundle is uploaded to `~/project-pn/deploy/web/` and served by Compose nginx.
Production HTTPS is terminated by ingress-nginx and proxied to Compose `:53412`.

## Verification Checklist

Copy and check off after deploy:

```text
- [ ] scripts/deploy-remote.sh completed with {"status":"ready"}
- [ ] curl http://localhost:53412/ returns index.html (on server)
- [ ] curl https://pn.nacfson.cloud/readyz succeeds (LE cert, not Fake Certificate)
- [ ] curl https://auth.nacfson.cloud/login returns 200 (magic-link UI)
- [ ] Browser loads the web app without CORS or cert errors
- [ ] Magic-link central login works
- [ ] Lookup word and add learning item work
```

## Quick Troubleshooting

| Symptom | First Check |
|---|---|
| `curl localhost:53412` fails on Mac | Use `192.168.219.120:53412`, not Mac `localhost` |
| `ERR_CERT_AUTHORITY_INVALID` | See `deploy/deploy-exception-runbook.md` TLS section |
| Public IP connection refused | Router port-forward `443` (and `80`) to `.120` |
| CORS error in browser | `ALLOWED_ORIGINS` in remote `.env` |
| 502 Bad Gateway | `docker compose logs api` or `kubectl -n ingress-nginx logs` |
| Migration password failed | `EXISTING_POSTGRES_PASSWORD` in `deploy/.deploy.env` |
| Old bundle still shown | Force recreate nginx: `docker compose up -d --force-recreate nginx` |
| Magic link wrong redirect | `APP_PUBLIC_URL=https://pn.nacfson.cloud` in remote `.env` |
| Password login expected | Removed — auth is magic-link only on `auth.nacfson.cloud` |
| Auth/K8s image deploy | Use `~/.cursor/skills/deploy-nacfson-project/SKILL.md` (not this Compose flow) |
| Magic link opens PN but Sign In again (401) | Auth NodePort dead — `curl http://192.168.219.120:31956/healthz`; Service must be `NodePort 31956` matching `CENTRAL_AUTH_INTERNAL_URL` |

For deeper diagnosis, read `deploy/deploy-exception-runbook.md`.

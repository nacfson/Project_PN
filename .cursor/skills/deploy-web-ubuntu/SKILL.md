---
name: deploy-web-ubuntu
description: >-
  Build and deploy the Project PN web app (Expo Web static bundle + Go backend)
  to the remote Ubuntu server (zlUbuntu). Use when the user asks to deploy the
  web app, build and deploy frontend, publish the web build, deploy to zlUbuntu,
  or update the Project PN website/server.
---

# Deploy Project PN Web to zlUbuntu

Builds the Expo web bundle and the Go backend Docker image locally, then uploads
both to `zlUbuntu` and starts the Docker Compose stack.

## Prerequisites

Before running the deploy, confirm:

- [ ] You are on the local Mac with the Project PN repo at `/Users/hyungjuyu/Projects/iOS/Project_PN`.
- [ ] Docker Desktop is running.
- [ ] `npm`, `git`, `ssh`, and `scp` are available.
- [ ] `zlUbuntu` is reachable via SSH alias in `~/.ssh/config`.
- [ ] `deploy/.deploy.env` exists and contains:
  ```env
  DEPLOY_HOST=zlUbuntu
  DEPLOY_PUBLIC_URL=http://124.59.225.59:53412
  DEPLOY_ACCESS_SCOPE=public
  REMOTE_DIR='~/project-pn/deploy'
  IMAGE_NAME=project-pn-backend
  PLATFORM=linux/amd64
  ```
- [ ] The remote `~/project-pn/deploy/.env` has the correct `ALLOWED_ORIGINS` and `APP_PUBLIC_URL`.
- [ ] TLS certs exist at `~/project-pn/deploy/certs/` if you need HTTPS on port 443.

## Deploy Workflow

Run every step from the repo root:

```sh
cd /Users/hyungjuyu/Projects/iOS/Project_PN
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

- Staging over HTTP custom port: `http://124.59.225.59:53412`
- Production HTTPS domain: `https://YOUR_DOMAIN`

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

SSH into `zlUbuntu`:

```sh
ssh zlUbuntu
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
curl http://192.168.219.100:53412/ | head
curl http://192.168.219.109:53412/ | head
```

### 6. Verify from public internet

From outside the LAN:

```sh
curl http://124.59.225.59:53412/ | head
curl http://124.59.225.59:53412/healthz
```

### 7. Browser smoke test

Open the public or intranet URL in a browser:

1. Register or log in.
2. Go to the Capture screen.
3. Paste text and tap a word.
4. Confirm `POST /api/words/lookup` succeeds.
5. Pick a sense and add it.
6. Confirm `POST /api/learning-items` succeeds and the chip shows "added".

## How the Build Works

`scripts/deploy-remote.sh` builds the frontend with:

```sh
cd frontend
npm install
EXPO_PUBLIC_API_BASE_URL= npm run web:export
```

`EXPO_PUBLIC_API_BASE_URL` is intentionally **empty** so the exported bundle
resolves API calls from `window.location.origin`. This lets the same bundle work
on both intranet (`192.168.219.x`) and public (`124.59.225.59`) URLs.

The bundle is uploaded to `~/project-pn/deploy/web/` and served by nginx at `/`.
nginx proxies these paths to the Go backend:

- `/api/*`
- `/healthz`
- `/readyz`
- `/auth/callback`

## Verification Checklist

Copy and check off after deploy:

```text
- [ ] scripts/deploy-remote.sh completed with {"status":"ready"}
- [ ] curl http://localhost:53412/ returns index.html (on server)
- [ ] curl http://192.168.219.100:53412/ returns index.html (intranet)
- [ ] curl http://124.59.225.59:53412/ returns index.html (public)
- [ ] Browser loads the web app without CORS errors
- [ ] Login / register works
- [ ] Lookup word and add learning item work
```

## Quick Troubleshooting

| Symptom | First Check |
|---|---|
| `curl localhost:53412` fails on Mac | Use server IP, not Mac `localhost` |
| Public IP connection refused | Router port-forward rule for `53412/tcp` |
| CORS error in browser | `ALLOWED_ORIGINS` in remote `.env` |
| 502 Bad Gateway | `docker compose logs api` on server |
| Migration password failed | `EXISTING_POSTGRES_PASSWORD` in `deploy/.deploy.env` |
| Old bundle still shown | Force recreate nginx: `docker compose up -d --force-recreate nginx` |
| Magic link wrong redirect | `APP_PUBLIC_URL` in remote `.env` |

For deeper diagnosis, read `deploy/deploy-exception-runbook.md`.

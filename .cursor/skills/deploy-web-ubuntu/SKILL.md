---
name: deploy-web-ubuntu
description: >-
  Build and deploy the Project PN web app (Expo Web static bundle + Go backend)
  to the remote Oracle Cloud Ubuntu instance (SSH alias OracleCloud). Use when
  the user asks to deploy the web app, build and deploy frontend, publish the
  web build, deploy to Oracle Cloud / OCI, or update the Project PN website/server.
---

# Deploy Project PN Web to Oracle Cloud

Builds the Expo web bundle and the Go backend Docker image locally, then uploads
both to the Oracle Cloud Ubuntu host (`OracleCloud`) and starts the Docker
Compose stack.

## Prerequisites

Before running the deploy, confirm:

- [ ] You are on the local Mac with the Project PN repo at `/Users/hyungjuyu/Projects/iOS/Project_PN`.
- [ ] Docker Desktop is running.
- [ ] `npm`, `git`, `ssh`, and `scp` are available.
- [ ] `OracleCloud` is reachable via SSH alias in `~/.ssh/config`.
- [ ] `deploy/.deploy.env` exists and contains:
  ```env
  DEPLOY_HOST=OracleCloud
  DEPLOY_PUBLIC_URL=https://YOUR_PUBLIC_DOMAIN
  DEPLOY_ACCESS_SCOPE=public
  REMOTE_DIR='~/project-pn/deploy'
  IMAGE_NAME=project-pn-backend
  PLATFORM=linux/amd64
  ```
- [ ] The remote `~/project-pn/deploy/.env` has the correct `ALLOWED_ORIGINS` and `APP_PUBLIC_URL`.
- [ ] OCI Security List / NSG allows inbound `22`, `80`, `443` (and optional `53412`).
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

- Production HTTPS domain: `https://YOUR_PUBLIC_DOMAIN`
- HTTP staging on OCI public IP: `http://YOUR_ORACLE_PUBLIC_IP:53412`

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

SSH into Oracle Cloud:

```sh
ssh OracleCloud
cd ~/project-pn/deploy
docker compose ps
curl http://localhost:53412/ | head
curl http://localhost:53412/healthz
# or, if using 80/443 only:
curl http://localhost/healthz
```

Expected:

- `index.html` content from `/`
- `{"status":"ok"}` from `/healthz`

### 5. Verify from public internet

```sh
curl https://YOUR_PUBLIC_DOMAIN/ | head
curl https://YOUR_PUBLIC_DOMAIN/healthz
```

### 6. Browser smoke test

Open the public URL in a browser:

1. Register or log in.
2. Go to Learn → Curriculum and confirm packs load (if on a build that includes curriculum).
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
resolves API calls from `window.location.origin`.

The bundle is uploaded to `~/project-pn/deploy/web/` and served by nginx at `/`.
nginx proxies these paths to the Go backend:

- `/api/*`
- `/healthz`
- `/readyz`
- `/auth/callback`

## Verification Checklist

```text
- [ ] scripts/deploy-remote.sh completed with {"status":"ready"}
- [ ] curl on server returns index.html and healthz ok
- [ ] curl https://YOUR_PUBLIC_DOMAIN returns index.html
- [ ] Browser loads without CORS errors
- [ ] Login works
- [ ] Lookup word and add learning item work
```

## Quick Troubleshooting

| Symptom | First Check |
|---|---|
| `curl localhost` fails on Mac | Use Oracle public IP/domain, not Mac `localhost` |
| Public IP connection refused | OCI Security List / NSG ingress for `80`/`443`/`53412` |
| CORS error in browser | `ALLOWED_ORIGINS` in remote `.env` |
| 502 Bad Gateway | `docker compose logs api` on OracleCloud |
| Migration password failed | `EXISTING_POSTGRES_PASSWORD` in `deploy/.deploy.env` |
| Old bundle still shown | Force recreate nginx: `docker compose up -d --force-recreate nginx` |
| Auth outbound fails | Remove home-LAN `extra_hosts` overrides; confirm OCI egress |

For deeper diagnosis, read `deploy/deploy-exception-runbook.md` and `deploy/NETWORK_SETUP.md`.

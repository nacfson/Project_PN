---
name: update-backend-image
description: >-
  Rebuild and roll out only the Project PN Go backend Docker image to zlUbuntu
  (skip Expo web rebuild). Use when the user asks to update the backend image,
  refresh/rebuild the API Docker image, roll out backend-only server changes,
  update container images without redeploying the frontend, or run
  update-backend-image.
---

# Update Backend Docker Image on zlUbuntu

Rebuilds `project-pn-backend`, uploads it to `zlUbuntu`, syncs deploy
compose/nginx config, and restarts the API stack. **Does not** rebuild or
upload the Expo web bundle.

Use the full deploy skill (`.cursor/skills/deploy-web-ubuntu/SKILL.md`) when
frontend UI changes must ship too.

## Prerequisites

Before running, confirm:

- [ ] You are on the local Mac with the Project PN repo at `/Users/hyungjuyu/Projects/iOS/Project_PN`.
- [ ] Docker Desktop is running.
- [ ] `git`, `ssh`, `scp`, and `gzip` are available.
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
- [ ] Remote `~/project-pn/deploy/.env` already exists (bootstrap once with `scripts/deploy-remote.sh` if not).

## When to use this vs full deploy

| Change | Command / skill |
|--------|-----------------|
| Backend Go code, migrations in image, compose/nginx deploy config | `scripts/update-backend-image.sh` (this skill) |
| Expo web UI / static bundle | `scripts/deploy-remote.sh` (`deploy-web-ubuntu`) |
| Both backend and web | `scripts/deploy-remote.sh` |

## Workflow

Run every step from the repo root:

```sh
cd /Users/hyungjuyu/Projects/iOS/Project_PN
```

### 1. Review what will ship

```sh
git status
git log -1 --oneline
cat deploy/.deploy.env
```

Commit backend/deploy changes you intend to roll out. Do not push an unrelated dirty tree unless the user explicitly asks.

### 2. Update the image

```sh
scripts/update-backend-image.sh
```

Expected output sequence:

1. `building project-pn-backend:<sha> for linux/amd64`
2. `saving image to ...`
3. `syncing compose/nginx config (no frontend bundle)`
4. `loading image on remote server`
5. `restarting remote stack with BACKEND_IMAGE=...`
6. `checking remote /readyz` → `{"status":"ready"}`
7. `updated project-pn-backend:<sha> (frontend web bundle unchanged)`

Optional:

```sh
# Skip uploading compose.yaml / nginx.conf / .env.example
SYNC_DEPLOY_CONFIG=0 scripts/update-backend-image.sh
```

If any step fails, stop and consult `deploy/deploy-exception-runbook.md`.

### 3. Verify on the server

```sh
ssh zlUbuntu '
  cd ~/project-pn/deploy &&
  docker compose ps &&
  docker compose images &&
  curl -fsS http://localhost:53412/healthz &&
  curl -fsS http://localhost:53412/readyz
'
```

Expected:

- `api` image tag matches the git short SHA just built
- `/healthz` → `{"status":"ok"}`
- `/readyz` → `{"status":"ready"}`

### 4. Smoke-check logs (after logging/deploy config changes)

```sh
scripts/remote-logs.sh api --tail 50
scripts/remote-logs.sh admin --tail 50
```

Confirm admin audit path is mounted when `ADMIN_LOG_PATH` is set:

```sh
ssh zlUbuntu 'cd ~/project-pn/deploy && docker compose exec -T api ls -la /var/log/project-pn'
```

## How it works

`scripts/update-backend-image.sh`:

1. Builds `backend/Dockerfile` for `PLATFORM` (default `linux/amd64`).
2. Tags `project-pn-backend:<git-short-sha>` and `:latest`.
3. `docker save | gzip`, `scp` to the host, `docker load`.
4. Uploads `deploy/compose.yaml`, `deploy/nginx/nginx.conf`, and `deploy/.env.example` (unless `SYNC_DEPLOY_CONFIG=0`).
5. Appends `ADMIN_LOG_PATH=/var/log/project-pn/admin.log` to remote `.env` if missing.
6. Runs `BACKEND_IMAGE=project-pn-backend:<sha> docker compose --env-file .env up -d`.
7. Curls remote `/readyz`.

Migrations run via the compose `migrate` service when the new image starts.

## Verification checklist

```text
- [ ] scripts/update-backend-image.sh finished with {"status":"ready"}
- [ ] docker compose images shows the new backend SHA on api
- [ ] /healthz and /readyz succeed
- [ ] Backend behavior under test works (no stale container)
- [ ] Frontend unchanged is acceptable for this roll-out
```

## Quick troubleshooting

| Symptom | First check |
|---------|-------------|
| Docker build fails | Docker Desktop running; `backend/Dockerfile` builds locally |
| SSH / SCP fails | `ssh zlUbuntu` works; `DEPLOY_HOST` in `.deploy.env` |
| Remote `.env` missing | Bootstrap once with `scripts/deploy-remote.sh` |
| 502 after update | `scripts/remote-logs.sh api` and `migrate` |
| Old API behavior | Confirm `BACKEND_IMAGE` SHA in `docker compose ps` / `images` |
| Need web UI too | Use `.cursor/skills/deploy-web-ubuntu/SKILL.md` instead |

For deeper diagnosis, read `deploy/deploy-exception-runbook.md`.

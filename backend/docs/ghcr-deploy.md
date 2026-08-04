# GHCR Deploy

An alternative to the tarball-over-SSH flow in `remote-deploy-runbook.md`. Instead
of `docker save | scp | docker load`, the backend image is published to GitHub
Container Registry (GHCR) and the server pulls it.

This is the recommended path for **cloud/CI deploys** (e.g. GitHub Actions) and
for deploying to an AWS EC2 instance.

Image location: `ghcr.io/<owner>/project-pn-backend` (for this repo,
`ghcr.io/nacfson/project-pn-backend`).

The deploy stack is already registry-agnostic: `deploy/compose.yaml` uses
`image: ${BACKEND_IMAGE:-project-pn-backend:latest}`, so pointing `BACKEND_IMAGE`
at a GHCR ref is all the server needs.

## Option A — Publish automatically with GitHub Actions (no PAT needed)

`.github/workflows/publish-backend.yml` builds a multi-arch image
(`linux/amd64` + `linux/arm64`) and pushes it to GHCR on:

- push to `main` (tags the image `latest` and `sha-<short>`)
- push of a `v*` tag (tags the image with the version)
- manual `workflow_dispatch`

It authenticates with the built-in `GITHUB_TOKEN` via `permissions: packages: write`,
so **no personal access token or extra secret is required to publish**.

After the first successful run, the package appears under the repo/owner's
Packages. By default it is **private**; make it public (Package settings →
Change visibility) if you want the server to pull without logging in, and link
it to the repository for inherited permissions.

## Option B — Publish manually / from your machine

Requires a classic PAT with `write:packages`:

```sh
echo "$CR_PAT" | docker login ghcr.io -u <github-username> --password-stdin
docker buildx build \
  --platform linux/amd64 \
  -t ghcr.io/nacfson/project-pn-backend:v1 \
  -f backend/Dockerfile --push backend
```

Build `--platform linux/arm64` (or a comma-separated multi-arch list) if the
target server is Graviton/ARM.

`scripts/deploy-ghcr.sh` wraps build+push and the remote pull+start (mirrors
`scripts/deploy-remote.sh` but registry-based). It reads `deploy/.deploy.env`.

## Consume the image on the server

1. Log in to GHCR **only if the package is private** (needs `read:packages`):

   ```sh
   echo "$CR_PAT" | docker login ghcr.io -u <github-username> --password-stdin
   ```

2. Set the image ref in the remote `deploy/.env`:

   ```env
   BACKEND_IMAGE=ghcr.io/nacfson/project-pn-backend:latest
   ```

3. Pull and start:

   ```sh
   cd ~/project-pn/deploy
   docker compose --env-file .env pull
   docker compose --env-file .env up -d
   curl http://127.0.0.1:53412/readyz   # {"status":"ready"}
   ```

The `web/` bundle, `nginx/nginx.conf`, and `compose.yaml` still need to reach the
server (via `scripts/deploy-ghcr.sh`, `scp`, or a `git pull` on the server); GHCR
only carries the backend image.

## Self-updating instance (pull-based: fix → GHCR → instance updates itself)

This is the recommended flow when you do **not** want to hand SSH keys to CI or
an agent. The instance polls the registry and redeploys itself whenever a new
image is published:

1. A `fix` is merged → the `publish-backend.yml` workflow pushes a new
   `ghcr.io/nacfson/project-pn-backend:latest` (and `sha-…`) image.
2. A systemd timer on the instance runs `deploy/self-update.sh`, which does
   `docker compose pull && up -d` and only restarts when the image digest
   changed. Compose runs the one-shot `migrate` before `api`, so schema
   migrations are applied on every update.

Set up once on the server:

```sh
cd ~/project-pn/deploy

# Point the stack at the GHCR image.
grep -q '^BACKEND_IMAGE=' .env \
  && sed -i 's|^BACKEND_IMAGE=.*|BACKEND_IMAGE=ghcr.io/nacfson/project-pn-backend:latest|' .env \
  || echo 'BACKEND_IMAGE=ghcr.io/nacfson/project-pn-backend:latest' >> .env

# Only needed if the GHCR package is private:
# echo "$CR_PAT" | docker login ghcr.io -u nacfson --password-stdin

chmod +x self-update.sh

# Install the timer (edit User/paths in the unit files for your distro/user).
sudo cp systemd/project-pn-update.service systemd/project-pn-update.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now project-pn-update.timer
```

Check it:

```sh
systemctl list-timers project-pn-update.timer
journalctl -u project-pn-update.service -n 50 --no-pager
```

Notes:
- The timer polls (default every ~3 min). For a moving `latest` tag this is the
  simplest event-free approach; tune `OnUnitActiveSec` in the `.timer`.
- Watchtower is an alternative, but it swaps the `api` container in place and
  does **not** run the compose `migrate` step, so the timer + `compose up -d`
  approach is preferred for this stack.
- For credential-free pulls (no PAT on the box at all), switch the registry to
  ECR and give the EC2 instance an IAM role — see the notes below.

## Notes / gotchas

- **Architecture** must match the server CPU. The Actions workflow builds both
  `amd64` and `arm64`; a manual `docker build` builds only the host arch unless
  you pass `--platform`.
- **Private vs public package**: public pulls need no login; private pulls need
  `docker login ghcr.io` on the server with a `read:packages` token.
- **Extending CI to deploy to EC2**: add a follow-up job that SSHes into the
  instance and runs the pull+up in step 3. It needs your own secrets
  (`EC2_HOST`, `EC2_USER=ec2-user`, `EC2_SSH_KEY`); GHCR itself needs none.
- The frontend is still shipped as a static bundle (`deploy/web/`), not a GHCR
  image. `frontend/Dockerfile.web` exists if you later want to publish a
  `project-pn-frontend` image too.

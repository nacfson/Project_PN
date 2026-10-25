# GHCR Deploy

Project PN production images are built in GitHub Actions cloud sessions (`.github/workflows/publish-ghcr-images.yml`), published to GitHub Container Registry, and rolled out on **Oracle Cloud k3s** (or `nacfson_pipeline`).

| Image | Registry path |
|-------|----------------|
| Backend API | `ghcr.io/nacfson/project-pn-backend` |
| Frontend SPA (nginx) | `ghcr.io/nacfson/project-pn-frontend` |

Runtime secrets (`DATABASE_URL`, etc.) are **not** in images. Configure them via **Cursor environment secrets** — see [`cursor-secrets.md`](cursor-secrets.md).

Rollout after publish: [`oracle-deploy-runbook.md`](oracle-deploy-runbook.md).

## Publishing Images (GitHub Actions Cloud Session)

Project PN container images are built and pushed exclusively in GitHub Actions cloud runners (`.github/workflows/publish-ghcr-images.yml`), gated by `.github/workflows/quality-gates.yml` (`spec 002`). Local `docker buildx` image builds are retired.

- **Automatic on `main`**: Every push to `main` runs `quality-gates` + `preflight-checks` and publishes both `project-pn-backend` and `project-pn-frontend`.
- **On-demand CLI dispatch (`scripts/push-ghcr.sh`)**: Trigger a GitHub Actions cloud build from your terminal using `scripts/push-ghcr.sh` (which wraps `gh workflow run publish-ghcr-images.yml`):

```sh
# Dispatch & watch both backend and frontend images in GitHub Actions
scripts/push-ghcr.sh --watch

# Or dispatch individual targets in GitHub Actions:
TARGET=frontend scripts/push-ghcr.sh --watch
TARGET=backend scripts/push-ghcr.sh --watch
```

- **Authentication**: Handled inside GitHub Actions via `GITHUB_TOKEN` (`packages: write`); no local `GHCR_TOKEN` PAT is needed. Only `gh` CLI authentication is needed to dispatch/watch runs.
- **Platforms**: Multi-arch `linux/amd64,linux/arm64` (Oracle Ampere requires `arm64`). `backend/Dockerfile` uses `FROM --platform=$BUILDPLATFORM` with native Go cross-compilation (`GOOS=linux GOARCH=arm64`).
- **Frontend export**: `preflight-checks` runs `EXPO_PUBLIC_API_BASE_URL= npm run web:export` (same-origin API under Traefik ForwardAuth, `spec 001`) and uploads the artifact to `publish-frontend`.

Skill: [`.cursor/skills/push-ghcr-images/SKILL.md`](../../.cursor/skills/push-ghcr-images/SKILL.md).

## Consume on Oracle (k3s)

1. Ensure the cluster has `imagePullSecrets` for GHCR if packages are private (`ghcr-pull`).
2. Run migrate Job with the new backend tag.
3. `kubectl set image` on `project-pn-backend` and `project-pn-frontend`.
4. `kubectl rollout status`.

Full steps: [`oracle-deploy-runbook.md`](oracle-deploy-runbook.md).

## Notes

- **Architecture:** Oracle Ampere needs `linux/arm64`. An amd64-only tag will not run on production nodes.
- **Private packages:** cluster needs `read:packages` credentials in a pull secret.
- **Frontend:** baked at build time via `EXPO_PUBLIC_API_BASE_URL= npm run web:export` inside the GitHub Actions workflow (`publish-ghcr-images.yml`).
- **Removed:** Local `docker buildx` image publishing and Compose pull on wlUbuntu (`deploy/compose.yaml`, `deploy-remote.sh`, `self-update.sh`) — do not use for production.

## Extending CI

To auto-rollout after GHCR push, add a deploy job that SSHes to Oracle and runs kubectl (requires your own `SSH_KEY` / host secrets in GitHub Actions, or a Cursor-managed deploy step). GHCR publish alone does not restart pods.

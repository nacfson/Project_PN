# GHCR Deploy

Project PN production images are published to GitHub Container Registry and rolled out on **Oracle Cloud k3s**.

| Image | Registry path |
|-------|----------------|
| Backend API | `ghcr.io/nacfson/project-pn-backend` |
| Frontend SPA (nginx) | `ghcr.io/nacfson/project-pn-frontend` |

Runtime secrets (`ENRICH_PRIMARY_API_KEY`, `DATABASE_URL`, etc.) are **not** in images. Configure them via **Cursor environment secrets** — see [`cursor-secrets.md`](cursor-secrets.md).

Rollout after publish: [`oracle-deploy-runbook.md`](oracle-deploy-runbook.md).

## Option A — GitHub Actions (no PAT to publish)

`.github/workflows/publish-ghcr-images.yml` builds and pushes on push to `main`:

- Tags: `<git-short-sha>` and `latest`
- Platform: `linux/amd64` (workflow); use `scripts/push-ghcr.sh` for multi-arch including `linux/arm64` required by Oracle Ampere

Authenticates with `GITHUB_TOKEN` (`permissions: packages: write`).

## Option B — Manual multi-arch push

Requires `GHCR_TOKEN` with `write:packages`:

```sh
GHCR_TOKEN=... TARGET=all scripts/push-ghcr.sh
```

Skill: [`.cursor/skills/push-ghcr-images/SKILL.md`](../../.cursor/skills/push-ghcr-images/SKILL.md).

Build arm64 (or multi-arch) for Oracle:

```sh
PLATFORMS=linux/arm64 TARGET=backend scripts/push-ghcr.sh
# or PLATFORMS=linux/amd64,linux/arm64 TARGET=all
```

## Consume on Oracle (k3s)

1. Ensure the cluster has `imagePullSecrets` for GHCR if packages are private (`ghcr-pull`).
2. Run migrate Job with the new backend tag.
3. `kubectl set image` on `project-pn-backend` and `project-pn-frontend`.
4. `kubectl rollout status`.

Full steps: [`oracle-deploy-runbook.md`](oracle-deploy-runbook.md).

## Notes

- **Architecture:** Oracle Ampere needs `linux/arm64`. An amd64-only tag will not run on production nodes.
- **Private packages:** cluster needs `read:packages` credentials in a pull secret.
- **Frontend:** baked at build time via `npm run web:export` inside the push script / GHA workflow; env vars like `EXPO_PUBLIC_CENTRAL_AUTH_URL` must be set at build time.
- **Removed:** Compose pull on wlUbuntu (`deploy/compose.yaml`, `deploy-remote.sh`, `self-update.sh`) — do not use for production.

## Extending CI

To auto-rollout after GHCR push, add a deploy job that SSHes to Oracle and runs kubectl (requires your own `SSH_KEY` / host secrets in GitHub Actions, or a Cursor-managed deploy step). GHCR publish alone does not restart pods.

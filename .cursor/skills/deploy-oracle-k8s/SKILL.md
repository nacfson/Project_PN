---
name: deploy-oracle-k8s
description: >-
  Publish Project PN images to GHCR via GitHub Actions cloud sessions and roll out
  to Oracle Cloud k3s (project-pn namespace). Secrets are managed via Cursor
  environment secrets, not repo or host .env files. Use when the user asks to
  deploy to production, Oracle Cloud, or roll out a new backend/frontend image.
---

# Deploy Project PN to Oracle Cloud (k3s)

Production is **Oracle Cloud Ampere / k3s**, not Docker Compose on a home Ubuntu box.

| Item | Value |
|------|--------|
| Namespace | `project-pn` |
| Backend | `deploy/project-pn-backend`, container `api` |
| Frontend | `deploy/project-pn-frontend`, container `nginx` |
| Images | `ghcr.io/nacfson/project-pn-backend`, `ghcr.io/nacfson/project-pn-frontend` |
| Public URL | ${APP_PUBLIC_URL} |
| Secrets | Cursor environment secrets — see `backend/docs/cursor-secrets.md` |

## Do not use (removed)

- Local `docker buildx` image publishing — all images are built in GitHub Actions cloud sessions
- `scripts/deploy-remote.sh`, `deploy/compose.yaml`, `~/project-pn/deploy/.env`
- wlUbuntu / zlUbuntu Compose paths
- Committing API keys or `ENRICH_*` values to the repo

## Prerequisites

- [ ] Changes merged or pushed to GitHub (`main` triggers `.github/workflows/publish-ghcr-images.yml` automatically)
- [ ] `gh` CLI authenticated if dispatching/watching a cloud build on demand
- [ ] SSH access to Oracle host (`opc@<oracle-host>`) for `kubectl`
- [ ] Runtime secrets configured in **Cursor environment secrets**

## 1. Publish images (GitHub Actions Cloud Session)

Images are built and published automatically on push to `main` via `.github/workflows/publish-ghcr-images.yml` (after `quality-gates.yml` passes), or dispatched on demand from the CLI:

```sh
scripts/push-ghcr.sh --watch
# or TARGET=frontend scripts/push-ghcr.sh --watch / TARGET=backend scripts/push-ghcr.sh --watch
```

Note the image tag (git short SHA) and digests from the GitHub Actions run summary.

## 2. Roll out on Oracle

On the Oracle host with `KUBECONFIG=/secure/production.conf`:

1. Run migrate Job with new backend image (idempotent `./migrate up`)
2. `kubectl -n project-pn set image` for backend and frontend Deployments
3. `kubectl rollout status` both Deployments

Full commands: `backend/docs/oracle-deploy-runbook.md`

## 3. Verify

```sh
curl -fsS ${APP_PUBLIC_URL}/healthz
curl -fsS ${APP_PUBLIC_URL}/readyz
```

## Secrets

- Add or rotate keys in Cursor dashboard → Cloud Agents → Environments → Secrets
- Never paste secret values into chat, commits, or `environment.json`
- Docs: `backend/docs/cursor-secrets.md`

## Related skills

- `.cursor/skills/push-ghcr-images/SKILL.md` — trigger and watch GitHub Actions cloud image builds
- `backend/docs/oracle-deploy-runbook.md` — rollout and verification steps
- `~/.cursor/skills/deploy-nacfson-project/SKILL.md` — ProcessManager and other nacfson.cloud services (separate repo)

---
name: deploy-oracle-k8s
description: >-
  Publish Project PN images to GHCR and roll out to Oracle Cloud k3s (project-pn
  namespace). Secrets are managed via Cursor environment secrets, not repo or host
  .env files. Use when the user asks to deploy to production, Oracle Cloud,
  or roll out a new backend/frontend image.
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

- `scripts/deploy-remote.sh`, `deploy/compose.yaml`, `~/project-pn/deploy/.env`
- wlUbuntu / zlUbuntu Compose paths
- Committing API keys or `ENRICH_*` values to the repo

## Prerequisites

- [ ] Changes merged or ready to publish on `main`
- [ ] `GHCR_TOKEN` available for manual push (or rely on GitHub Actions workflow)
- [ ] SSH access to Oracle host (`opc@<oracle-host>`) for `kubectl`
- [ ] Runtime secrets (`ENRICH_PRIMARY_API_KEY`, etc.) configured in **Cursor environment secrets**

## 1. Publish images

**CI (preferred):** push/merge to `main` → `.github/workflows/publish-ghcr-images.yml`

**Manual:**

```sh
GHCR_TOKEN=... TARGET=all scripts/push-ghcr.sh
```

Note the image tag (git short SHA).

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

Authenticated lookup of an unknown word should return **200** (not enrichment 503) when `ENRICH_PRIMARY_API_KEY` is set in Cursor secrets.

## Secrets

- Add or rotate keys in Cursor dashboard → Cloud Agents → Environments → Secrets
- Never paste secret values into chat, commits, or `environment.json`
- Docs: `backend/docs/cursor-secrets.md`

## Related skills

- `.cursor/skills/push-ghcr-images/SKILL.md` — build and push both images
- `backend/docs/oracle-deploy-runbook.md` — central-auth (`auth-service`) rolls and Google OAuth sync
- `~/.cursor/skills/deploy-nacfson-project/SKILL.md` — ProcessManager and other nacfson.cloud services (separate repo)

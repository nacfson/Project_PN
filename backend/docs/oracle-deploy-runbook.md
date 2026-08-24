# Oracle Cloud Deploy Runbook

Production Project PN runs on **Oracle Cloud Ampere (arm64)** in k3s namespace `project-pn`.

- **App**: $APP_PUBLIC_URL
- **Auth**: `auth.nacfson.cloud` (namespace `nacfson-auth`)
- **Images**: `ghcr.io/nacfson/project-pn-backend`, `ghcr.io/nacfson/project-pn-frontend`
- **Secrets**: Cursor environment secrets (see [`cursor-secrets.md`](cursor-secrets.md)) — not host `.env` files

There is **no** Docker Compose stack on the production host. Do not use removed scripts such as `deploy-remote.sh`.

## Architecture

```text
Internet → host nginx (TLS :443) → ingress-nginx NodePort → k3s Ingress
  → project-pn-frontend (nginx SPA)
  → project-pn-backend (Go API)
  → postgres (StatefulSet)
  → enricher (optional sidecar/service)
```

Migrations run as a one-shot Job `project-pn-migrate` (`./migrate up`), not on API startup.

## Publish images (GHCR)

### Option A — GitHub Actions (recommended)

`.github/workflows/publish-ghcr-images.yml` builds and pushes on push to `main`:

- `ghcr.io/nacfson/project-pn-backend:<sha>` and `:latest`
- `ghcr.io/nacfson/project-pn-frontend:<sha>` and `:latest`

Uses `GITHUB_TOKEN`; no extra PAT required to publish.

### Option B — Manual multi-arch push

From a machine with Docker buildx and `GHCR_TOKEN`:

```bash
GHCR_TOKEN=... TARGET=all scripts/push-ghcr.sh
```

See [`.cursor/skills/push-ghcr-images/SKILL.md`](../../.cursor/skills/push-ghcr-images/SKILL.md).

Oracle pods need **arm64**. Ensure the tag you roll out exists for `linux/arm64` (the push script builds `linux/amd64,linux/arm64`).

## Roll out on Oracle (kubectl)

SSH to the Oracle host as `opc`. Kubeconfig: `/secure/production.conf`.

Replace `<tag>` with the GHCR tag (e.g. short git SHA from CI).

### 1. Migrate (idempotent)

Clone the existing migrate Job with the new backend image, or patch image on a one-shot Job:

```bash
sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn get job project-pn-migrate -o yaml
# Apply a Job using the new backend image tag; wait for complete:
sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn wait --for=condition=complete --timeout=120s job/<migrate-job-name>
```

### 2. Set Deployment images

```bash
sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn set image \
  deploy/project-pn-backend api=ghcr.io/nacfson/project-pn-backend:<tag>

sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn set image \
  deploy/project-pn-frontend nginx=ghcr.io/nacfson/project-pn-frontend:<tag>
```

### 3. Wait for rollout

```bash
sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn rollout status deploy/project-pn-backend
sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn rollout status deploy/project-pn-frontend
```

Revert: `kubectl rollout undo deploy/project-pn-backend -n project-pn` (and frontend).

## Verify

```bash
curl -fsS ${APP_PUBLIC_URL}/healthz    # {"status":"ok"}
curl -fsS ${APP_PUBLIC_URL}/readyz     # {"status":"ready"}
curl -fsS -o /dev/null -w '%{http_code}\n' ${APP_PUBLIC_URL}/
curl -fsS -o /dev/null -w '%{http_code}\n' ${APP_PUBLIC_URL}/api/curriculum/packs
# 401 without auth = route live
```

## Secrets and repeated deploys

Image rollouts do **not** remove secrets. Configure `ENRICH_PRIMARY_API_KEY` and other runtime values once in **Cursor environment secrets**; they persist across deploys until you rotate them in Cursor.

Do not put secrets in this repo or in GHCR image layers.

## Auth / ProcessManager rolls

Auth service and ProcessManager use separate namespaces and images. See `~/.cursor/skills/deploy-nacfson-project/SKILL.md` on your machine (ProcessManager repo), not this runbook.

## Troubleshooting

See [`deploy/deploy-exception-runbook.md`](../../deploy/deploy-exception-runbook.md).

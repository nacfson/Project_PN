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

## Auth rolls (`auth.nacfson.cloud`)

Central auth runs in namespace `nacfson-auth` as `auth-service` using image `ghcr.io/nacfson/central-auth:<tag>`. Do **not** roll back to `processmanager`.

SSH + kubectl on Oracle host (`KUBECONFIG=/secure/production.conf`, full path `/usr/local/bin/kubectl`):

```bash
sudo KUBECONFIG=/secure/production.conf kubectl -n nacfson-auth set image \
  deploy/auth-service auth-service=ghcr.io/nacfson/central-auth:<tag>
sudo KUBECONFIG=/secure/production.conf kubectl -n nacfson-auth rollout status deploy/auth-service
```

Other nacfson.cloud services (ProcessManager, public site) use `~/.cursor/skills/deploy-nacfson-project/SKILL.md` in the ProcessManager repo.

### Integrated accounts rollout (Google OAuth + migration 000023)

Deploy **central-auth first**, then Project PN backend, then frontend:

1. **central-auth** (`nacfson-auth`): apply migration `002_oauth_identities` (revokes all sessions). Configure Cursor secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_BASE_URL`, `ADMIN_EMAILS`, SMTP or Resend for magic link). GCP redirect URI: `https://auth.nacfson.cloud/auth/google/callback`. Sync Google keys: `./scripts/sync-auth-google-secrets.sh`.
2. **Project PN backend**: migration `000023_integrated_accounts` (`linked_at`, merge tables, provider unique indexes).
3. **Frontend**: roll out SPA for Google login redirect and link/merge UI.

Expect **forced re-login** after central-auth migration 002. No pre-deploy SQL on the PN database is required.

### Verify Google OAuth on auth login page

```bash
curl -sS https://auth.nacfson.cloud/login | grep -E 'google-btn disabled|Sign in with Google'
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' \
  "https://auth.nacfson.cloud/auth/google?rd=${APP_PUBLIC_URL}"
```

Active button + `302` to `accounts.google.com` = configured. Grey disabled button = empty k8s secrets; run `scripts/sync-auth-google-secrets.sh` after setting Cursor secrets.

## Troubleshooting

See [`deploy/deploy-exception-runbook.md`](../../deploy/deploy-exception-runbook.md).

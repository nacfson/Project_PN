# Oracle Cloud Deploy Runbook

> **Migration note:** Target production is moving to **nacfson_pipeline** (`proj-pn` namespace) with `vault-db-proxy` Zero-Plaintext connectivity. See [Pipeline DB cutover](#pipeline-db-cutover-nacfson_pipeline) below. This Oracle section remains the legacy rollback path until cutover is complete.

Production Project PN (legacy) runs on **Oracle Cloud Ampere (arm64)** in k3s namespace `project-pn`.

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

> On the nacfson_pipeline path, TLS terminates at platform Traefik (spec 008) and PN pods receive plain HTTP. See [`NETWORK_SETUP.md`](../../deploy/NETWORK_SETUP.md#tls-platform-owned-spec-008).

On the Oracle path, migrations historically ran as a one-shot Job `project-pn-migrate` (`./migrate up`). New backend images also apply migrations on API startup (idempotent), which is required for the pipeline vault-db-proxy path.

## Publish images (GHCR)

Images are built and published to GHCR manually using `scripts/push-ghcr.sh` with Docker Buildx:

```bash
# Build & push both images (multi-arch: linux/amd64, linux/arm64)
GHCR_TOKEN=... TARGET=all scripts/push-ghcr.sh

# Or build individual targets:
GHCR_TOKEN=... TARGET=frontend scripts/push-ghcr.sh
GHCR_TOKEN=... TARGET=backend scripts/push-ghcr.sh
```

- **Registry**: `ghcr.io/nacfson/project-pn-backend` and `ghcr.io/nacfson/project-pn-frontend`
- **Tags**: `<git-short-sha>` and `latest`
- **Architecture**: `scripts/push-ghcr.sh` automatically builds multi-arch (`linux/amd64,linux/arm64`) required by Oracle Cloud Ampere.
- **Frontend bundle**: `npm run web:export` runs inside the script before packaging into Nginx image.

See [`.cursor/skills/push-ghcr-images/SKILL.md`](../../.cursor/skills/push-ghcr-images/SKILL.md) and [`ghcr-deploy.md`](ghcr-deploy.md).

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

## Pipeline DB cutover (nacfson_pipeline)

Target stack: FluxCD-managed namespace `proj-pn`, database `proj_pn` owned by `user_pn`, connectivity via `vault-db-proxy.vault.svc:5432` with caller token `project:pn:workload:backend` (no plaintext DB password in the pod).

### Prerequisites

1. Platform `postgres-init-job` created `proj_pn` / `user_pn`; OpenBao secret `kv/database/pn-user` seeded.
2. `vault-db-proxy` healthy; run `tests/vault/test_db_proxy.sh` in the nacfson_pipeline repo.
3. Backend image includes DB_* URL assembly, startup migrate, and UID 10001.
4. Pipeline manifests set `DB_HOST`/`DB_TOKEN` and netpol egress to `vault-db-proxy` (not direct Postgres).

### Restore historical data (local dump)

You already have a downloaded `.tar.gz` / `.dump.gz`. Port-forward admin Postgres, then:

```bash
kubectl -n identity port-forward svc/postgres 5432:5432
# in another shell:
PGPASSWORD=… scripts/migrate-local-dump-to-pipeline.sh /path/to/your-dump.tar.gz
```

The script restores into `proj_pn`, reassigns ownership to `user_pn`, and prints row counts for `users`, `words`, `decks`, `review_states`.

### Acceptance drills

| Drill | Command / check | Pass criteria |
|-------|-----------------|---------------|
| Wire proxy handshake | `tests/vault/test_db_proxy.sh` | Valid token accepted; invalid → SQLSTATE `28000` |
| Cross-DB isolation | connect as PN caller to `keycloak` | Rejected with SQLSTATE `42501` |
| Data sanity | row counts after restore | Match origin dump |
| App liveness | `curl -fsS http://pn-backend:8080/healthz` (and `/readyz`) | HTTP 200; pool healthy |

### Cutover and rollback

1. Validate pipeline stack in parallel while Oracle `project-pn` stays live.
2. Point DNS/ingress at pipeline when drills pass.
3. **Rollback data:** re-run `scripts/migrate-local-dump-to-pipeline.sh` (uses `pg_restore --clean --if-exists`).
4. **Rollback traffic:** leave Oracle deployments running until confident; revert ingress to Oracle if needed.
5. **Rollback workload:** revert Flux/Git image tag in `deploy/projects/pn/workloads/backend-deployment.yaml`.

## Secrets and repeated deploys

Image rollouts do **not** remove secrets. Configure `ENRICH_PRIMARY_API_KEY` and other runtime values once in **Cursor environment secrets**; they persist across deploys until you rotate them in Cursor.

Do not put secrets in this repo or in GHCR image layers.

## Platform Identity & Auth (`auth.nacfson.cloud`)

> [!IMPORTANT]
> Project PN authentication has migrated from legacy `central-auth` / ProcessManager to the `nacfson_pipeline` platform (Keycloak + Traefik ForwardAuth + in-cluster JWT verification).
> Refer to [`platform-identity-migration.md`](platform-identity-migration.md) for the active operator cutover runbook, NetworkPolicy, and Flux reconciliation layers.
> The legacy `central-auth` deployment below is retained for historical context only.

### Legacy central-auth (retired)

Central auth formerly ran in namespace `nacfson-auth` as `auth-service` using image `ghcr.io/nacfson/central-auth:<tag>`.

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

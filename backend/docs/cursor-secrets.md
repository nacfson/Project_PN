# Cursor Secrets (Production and Cloud Dev)

Project PN production runs on **Oracle Cloud k3s**. Runtime secrets (API keys, database URLs, auth tokens) are **not** stored in this repository.

Manage them through **Cursor environment secrets** (Cursor dashboard → Cloud Agents → Environments → Secrets). Cursor injects configured secrets into Cloud Agent pods and into the Oracle deployment pipeline you use for production rollouts.

## Rules

- **Never** commit secret values to git (`backend/.env`, `deploy/*`, scripts, or docs).
- **Never** bake secrets into Docker images. Images published to GHCR contain application code only.
- `.env.example` files document **variable names** only; values stay empty in the repo.
- For local development on a machine outside Cursor Cloud, copy `.env.example` → `.env` and fill values locally (gitignored).

## Production secrets (Oracle k3s)

These env vars must be available to the `project-pn-backend` Deployment (and the `enricher` Deployment if lookup enrichment runs there):

| Variable | Purpose |
|----------|---------|
| `ENRICH_PRIMARY_API_KEY` | Gemini (default) or other OpenAI-compatible enricher bearer token |
| `DATABASE_URL` | In-cluster Postgres connection string |
| `AUTH_SESSION_INTERNAL_TOKEN` | Validates central auth session cookies |
| `CENTRAL_AUTH_INTERNAL_URL` | Internal URL for session validation |
| `PUBLIC_APP_URL` | Frontend origin for magic-link redirect (`/link-approve?requestId=…`); default `http://localhost:8081` |

Optional enricher overrides (defaults apply when empty):

| Variable | Default when unset |
|----------|-------------------|
| `ENRICH_PRIMARY_BASE_URL` | Gemini OpenAI-compatible shim |
| `ENRICH_PRIMARY_MODEL` | `gemini-3.1-flash-lite` |
| `ENRICH_FALLBACK_*` | No fallback |

Configure these in **Cursor environment secrets** for the production environment linked to Oracle Cloud. After updating a secret, roll out the affected Deployment so pods pick up the new value (or rely on your Cursor-managed sync if configured).

## nacfson-auth secrets (`nacfson-auth` namespace)

Production `auth-service` runs **central-auth** (`ghcr.io/nacfson/central-auth`), not ProcessManager. Secrets are mounted from k8s `auth-bootstrap` and `auth-oauth-secrets`.

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth web client id |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `PUBLIC_BASE_URL` | `https://auth.nacfson.cloud` |
| `ADMIN_EMAILS` | Comma-separated admin emails |
| `AUTH_SESSION_INTERNAL_TOKEN` | Must match Project PN backend |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Magic-link email (production uses SMTP via `auth-bootstrap`) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Optional Resend fallback when SMTP is not configured |

GCP OAuth redirect URI (Web client): `https://auth.nacfson.cloud/auth/google/callback`.

Rollout note: migration `002_oauth_identities` revokes all active sessions (forced re-login).

### Sync Google OAuth to production

After adding or rotating `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in **Cursor environment secrets**, sync them into the cluster (never commit values):

```bash
# Verify lengths only — never log secret values
echo "GOOGLE_CLIENT_ID len=${#GOOGLE_CLIENT_ID}"
echo "GOOGLE_CLIENT_SECRET len=${#GOOGLE_CLIENT_SECRET}"

./scripts/sync-auth-google-secrets.sh
```

Requires Cursor secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DEPLOY_SSH_HOST`, `SSH_PRIVATE_KEY` (optional `DEPLOY_SSH_USER`, default `opc`).

The script updates both `auth-oauth-secrets` and `auth-bootstrap` (deployment reads Google keys from both), then restarts `auth-service`.

Verify:

```bash
curl -sS https://auth.nacfson.cloud/login | grep -E 'google-btn disabled|Sign in with Google'
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' \
  "https://auth.nacfson.cloud/auth/google?rd=${APP_PUBLIC_URL}"
# Expect: active button (no "disabled"), 302 redirect to accounts.google.com
```

Do **not** create empty placeholder secrets — empty keys disable the Google button with "Google sign-in is not configured for this build."

## Optional AWS S3 database-copy secrets

Used only by `scripts/db-dump-to-s3.sh` and `scripts/db-restore-from-s3.sh` (see [`db-s3-migration.md`](db-s3-migration.md)). Not required for the API, migrate Job, or Oracle rollout.

| Variable | Purpose |
|---|---|
| `S3_BACKUP_BUCKET` | Private backup bucket name |
| `S3_BACKUP_PREFIX` | Key prefix (default `postgres`) |
| `S3_BACKUP_ENV` | `local` or `prod` |
| `AWS_REGION` | Bucket region |
| `AWS_PROFILE` | Optional named AWS CLI profile |
| `S3_SSE` | `AES256` (default), `aws:kms`, or `none` |
| `S3_KMS_KEY_ID` | KMS key when `S3_SSE=aws:kms` |
| `AGE_RECIPIENT` | Optional `age` recipient for client-side encrypt |
| `AGE_IDENTITY_FILE` | Optional `age` identity path for decrypt |

Prefer the AWS CLI profile or SSO over long-lived `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. Never commit dump objects or keys.

## Cloud Agent development secrets

For Cursor Cloud Agents working in this repo:

1. Open the environment in [Cursor Cloud Agents → Environments](https://cursor.com/dashboard/cloud-agents/environments).
2. Add secrets (e.g. `ENRICH_PRIMARY_API_KEY`) in the environment **Secrets** section.
3. Secrets are injected as environment variables when agents and build pods start.

Local-only dev without Cursor secrets: use `backend/.env` (from `backend/.env.example`).

## Verify enrichment is configured

After secrets are applied and the API restarted:

```bash
curl -sS -X POST '${APP_PUBLIC_URL}/api/words/lookup' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <session-token>' \
  -d '{"text":"obscurewordxyz123","language_code":"en","display_language_code":"ko"}'
```

- **503** `word enrichment is not available; set ENRICH_PRIMARY_API_KEY...` → secret missing or not mounted on the pod.
- **503** `word enrichment provider unreachable or rejected...` → key present but invalid or provider outage.
- **200** with `sense_options` → enrichment working.

## Related docs

- [`db-s3-migration.md`](db-s3-migration.md) — dump/restore Postgres values through AWS S3
- [`oracle-deploy-runbook.md`](oracle-deploy-runbook.md) — image publish and k3s rollout
- [`ghcr-deploy.md`](ghcr-deploy.md) — GHCR image workflow
- [`go-backend-setup.md`](go-backend-setup.md) — local dev env vars
- [`../../docs/git-branches-and-worktrees.md`](../../docs/git-branches-and-worktrees.md) — branch and worktree conventions

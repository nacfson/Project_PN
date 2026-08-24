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

Optional enricher overrides (defaults apply when empty):

| Variable | Default when unset |
|----------|-------------------|
| `ENRICH_PRIMARY_BASE_URL` | Gemini OpenAI-compatible shim |
| `ENRICH_PRIMARY_MODEL` | `gemini-3.1-flash-lite` |
| `ENRICH_FALLBACK_*` | No fallback |

Configure these in **Cursor environment secrets** for the production environment linked to Oracle Cloud. After updating a secret, roll out the affected Deployment so pods pick up the new value (or rely on your Cursor-managed sync if configured).

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

- [`oracle-deploy-runbook.md`](oracle-deploy-runbook.md) — image publish and k3s rollout
- [`ghcr-deploy.md`](ghcr-deploy.md) — GHCR image workflow
- [`go-backend-setup.md`](go-backend-setup.md) — local dev env vars

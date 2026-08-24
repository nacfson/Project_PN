# Go Backend Setup

## Requirements

- Go installed locally.
- Docker Desktop or Docker Engine with Docker Compose.

Run backend commands from the `backend/` directory:

```sh
cd backend
```

Check tooling:

```sh
go version
docker --version
docker compose version
```

If Homebrew `go1.26.4` fails while building test binaries, use the downloaded Go toolchain explicitly:

```sh
GOTOOLCHAIN=go1.26.0 go test ./...
```

## Local Database

Start PostgreSQL:

```sh
docker compose up -d
```

The local database uses:

```text
database: project_pn_dev
user: project_pn
password: project_pn_dev_password
host port: 5433
container port: 5432
```

The development connection string is defined in `.env.example`:

```text
DATABASE_URL=postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable
```

## Migrations

`MIGRATIONS_PATH` defaults to `file://db/migrations` (relative to the `backend/` working directory). The migration runner is `golang-migrate/v4`. Apply, check, and roll back as follows.

Apply migrations:

```sh
go run ./cmd/migrate up
```

Check migration version:

```sh
go run ./cmd/migrate version
```

Roll back one migration:

```sh
go run ./cmd/migrate down -steps=1
```

## API Server

Run the API:

```sh
go run ./cmd/api
```

Health endpoints:

```sh
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
```

`/healthz` checks that the service is running. `/readyz` checks PostgreSQL connectivity.

## Web Development (Frontend + Backend Together)

Web builds need both the backend API and the Expo web dev server running. A single script starts the full stack:

```sh
scripts/start-web-dev.sh
```

This script will:

1. Start PostgreSQL via `backend/docker compose up -d` (skipped with `--skip-db`).
2. Wait for Postgres to become healthy.
3. Run backend migrations (`go run ./cmd/migrate up`; skipped with `--skip-migrate`).
4. Start the backend API in the background.
5. Start the Expo web dev server in the foreground (`npm run web`).
6. Stop the backend API when the web dev server exits.

If `.env` files are missing in `backend/` or `frontend/`, the script copies them from the corresponding `.env.example` files.

For faster restarts when Postgres is already running and migrations are up to date:

```sh
scripts/start-web-dev.sh --skip-db --skip-migrate
```

## Production deploy (Oracle Cloud k3s)

Production runs on **Oracle Cloud Ampere (arm64)** in k3s namespace `project-pn`. See `backend/docs/oracle-deploy-runbook.md`, `backend/docs/cursor-secrets.md`, and `.cursor/skills/deploy-oracle-k8s/SKILL.md`.

Publish images:

```sh
GHCR_TOKEN=... TARGET=all scripts/push-ghcr.sh
```

The backend image contains:

- Multi-stage build with **`CGO_ENABLED=0`** static binaries (`api`, `migrate`)
- Runtime: **`debian:bookworm-slim` + `ca-certificates`**
- Migrations copied to `/app/db/migrations`

Local development continues to use `backend/compose.yaml` (PostgreSQL on host port `5433`) and `go run ./cmd/api`.

## Environment Variables

All variables are read by `internal/config/config.go`. Defaults match `.env.example`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_ADDR` | `:8080` | HTTP listen address for `cmd/api`. |
| `DATABASE_URL` | `postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable` | PostgreSQL connection string used by `db.Open` and the migrate CLI. |
| `MIGRATIONS_PATH` | `file://db/migrations` | golang-migrate source URL. Resolved relative to the `backend/` working directory. |
| `ENRICH_PRIMARY_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` | Base URL of the primary OpenAI-compatible `/chat/completions` endpoint. The built-in default is Gemini's shim; set this only to use a different provider. (Alias: `ENRICH_BASE_URL`) |
| `ENRICH_PRIMARY_API_KEY` | empty | Bearer token for the primary enricher. Empty disables generation and on-demand translation; cache-only lookups and manual adds still work. (Alias: `ENRICH_API_KEY`) |
| `ENRICH_PRIMARY_MODEL` | `gemini-3.1-flash-lite` | Model name passed to the primary enricher. The default applies only with the built-in base URL; custom providers must set this explicitly. (Alias: `ENRICH_MODEL`) |
| `ENRICH_FALLBACK_BASE_URL` | empty | Optional fallback OpenAI-compatible `/chat/completions` endpoint (e.g. DeepSeek). |
| `ENRICH_FALLBACK_API_KEY` | empty | Bearer token for the fallback enricher. |
| `ENRICH_FALLBACK_MODEL` | empty | Model name passed to the fallback enricher (e.g. `deepseek-v4-flash`). |
| `DEFAULT_USER_ID` | `00000000-0000-0000-0000-000000000001` | Seeded dev user id (migration `000002`); retained on `words.Service` for tests. Protected API routes derive the acting user from the bearer session, not this env var. |
| `DEFAULT_TARGET_LANG` | `en` | Default `target_language` on register when omitted; fallback when a request omits `language_code`. |
| `DEFAULT_DEFINITION_LANG` | `ko` | Default `native_language` on register when omitted; fallback when a request omits `definition_language_code`. |
| `ALLOWED_TARGET_LANGS` | empty | Comma-separated ISO 639-1 codes users may select as `target_language`. Empty means unrestricted. |
| `ALLOWED_DEFINITION_LANGS` | empty | Comma-separated ISO 639-1 codes users may select as `native_language`. Empty means unrestricted. |
| `FORCE_TARGET_LANG` | empty | If set, all new users receive this `target_language` and the frontend hides the selector. |
| `FORCE_DEFINITION_LANG` | empty | If set, all new users receive this `native_language` and the frontend hides the selector. |
| `ALLOWED_ORIGINS` | `http://localhost:8081,http://localhost:19006,tauri://localhost,http://tauri.localhost` | Comma-separated CORS allow-list. Empty disables the CORS middleware. |


## Enrichment

The `Enricher` interface lives in `internal/enrich/`. The current implementation (`OpenAIEnricher`) calls any OpenAI-compatible chat-completions endpoint (Groq, DeepSeek, Gemini's OpenAI shim, OpenAI, etc.).

- No API key → `Enrich`/`Translate` return `ErrNotConfigured`, and the lookup endpoint returns HTTP 503 "word enrichment is not available; set ENRICH_PRIMARY_API_KEY or add the sense manually" on a cache miss. Cache hits and manual adds are unaffected.
- Provider unreachable or request rejected (bad key, outage) → `ErrUnavailable`, returned as HTTP 503 "word enrichment provider unreachable or rejected the request; check ENRICH_PRIMARY_* settings" instead of a generic 500.
- Primary and fallback set → enrichment runs synchronously inside the request, attempting primary first and falling back to secondary on failure. The result is persisted in the same transaction as the cache write.
- Model string is required when a custom (non-default) base URL is configured.

### Non-English study set fails to load (e.g. ja→ko)

Symptom: the app shows "학습 세트 불러오기 실패" / "… 학습 준비 중 오류 발생" for a non-English target language while en→ko works.

Cause: the backend has no working multilingual enrichment provider, so non-English content cannot be generated or translated on demand. The failing response identifies the exact gap:

- `503 "multilingual enrichment provider required for this target language"` — the configured model is the English-only `english-dictionary-fallback-v1` staging fallback.
- `503 "word enrichment is not available; set ENRICH_PRIMARY_API_KEY or add the sense manually"` — no API key configured.
- `503 "word enrichment provider unreachable or rejected the request; check ENRICH_PRIMARY_* settings"` — provider down or key rejected.
- `422 "localized translation unavailable for this word sense"` — adding a sense whose display-language translation is missing and cannot be generated.

Fix: set `ENRICH_PRIMARY_API_KEY` (base URL and model default to Gemini) and restart the API. Items added earlier without translations are backfilled lazily on the next lookup/add, or in bulk via `go run ./cmd/retranslate-senses`.

Enrichment is currently in-request and synchronous. A background queue is future scope (see `backend/docs/backend-future-scope.md`).

## Learning analytics logs (optional)

When `LEARNING_LOG_DIR` is set to an absolute directory path, the API appends one key=value row per learning event to daily files named `YYYYMMDD_log` (UTC). Events include `learning_item_added`, `review_attempted`, `sense_changed`, and `learning_item_archived` (leech suspend). This is separate from `ADMIN_LOG_PATH` admin audit logs. Leave `LEARNING_LOG_DIR` empty to disable. Row format and fields are defined in `docs/superpowers/specs/2026-07-27-learning-daily-log-design.md`.

## Tests

Run unit tests:

```sh
GOTOOLCHAIN=go1.26.0 go test ./...
```

Schema acceptance tests require `DATABASE_URL` and a running local PostgreSQL instance:

```sh
docker compose up -d
DATABASE_URL=postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable GOTOOLCHAIN=go1.26.0 go test -p 1 ./...
```

Run DB-backed suites with `-p 1`. Every package shares the single `DATABASE_URL`
and truncates the same tables, so the default parallel package execution deadlocks
(`ERROR: deadlock detected (SQLSTATE 40P01)`) or fails with foreign-key violations.
Prefer a dedicated database (for example `project_pn_test`) over the dev database so
test truncates cannot wipe local seed data, and stop the API server first — its
connection pool can hold locks that conflict with test truncates.

`internal/migrations/schema_acceptance_test.go` runs the acceptance scenarios in `backend/docs/backend-acceptance-tests.md` against a freshly migrated database. `internal/http/auth_handler_test.go`, `internal/http/words_handler_test.go`, and `internal/http/router_test.go` cover the HTTP layer (auth, validation, health endpoints, CORS, protected routes).

The MVP schema source of truth is `backend/docs/backend-schema-mvp.md`. Learning and review rules are in `backend/docs/learning-review-model.md`.

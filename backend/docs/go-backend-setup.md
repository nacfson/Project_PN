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
| `ORIGIN_WIKTAPI_BASE_URL` | `https://api.wiktapi.dev` | Free gloss dictionary origin (WiktApi). **No API key.** |
| `ENRICH_PRIMARY_BASE_URL` | empty (Gemini default only if key set) | Optional legacy OpenAI-compatible fallback base URL. (Alias: `ENRICH_BASE_URL`) |
| `ENRICH_PRIMARY_API_KEY` | empty | Optional legacy Gemini/OpenAI key used only when WiktApi misses. (Alias: `ENRICH_API_KEY`) |
| `ENRICH_PRIMARY_MODEL` | empty (`gemini-3.1-flash-lite` with Gemini default) | Model for optional legacy fallback. (Alias: `ENRICH_MODEL`) |
| `ENRICH_FALLBACK_BASE_URL` | empty | Optional second legacy fallback OpenAI-compatible endpoint. |
| `ENRICH_FALLBACK_API_KEY` | empty | Bearer token for the second legacy fallback. |
| `ENRICH_FALLBACK_MODEL` | empty | Model name for the second legacy fallback. |
| `DEFAULT_USER_ID` | `00000000-0000-0000-0000-000000000001` | Seeded dev user id (migration `000002`); retained on `words.Service` for tests. Protected API routes derive the acting user from the bearer session, not this env var. |
| `DEFAULT_TARGET_LANG` | `en` | Default `target_language` on register when omitted; fallback when a request omits `language_code`. |
| `DEFAULT_DEFINITION_LANG` | `ko` | Default `native_language` on register when omitted; fallback when a request omits `definition_language_code`. |
| `ALLOWED_TARGET_LANGS` | empty | Comma-separated ISO 639-1 codes users may select as `target_language`. Empty means unrestricted. |
| `ALLOWED_DEFINITION_LANGS` | empty | Comma-separated ISO 639-1 codes users may select as `native_language`. Empty means unrestricted. |
| `FORCE_TARGET_LANG` | empty | If set, all new users receive this `target_language` and the frontend hides the selector. |
| `FORCE_DEFINITION_LANG` | empty | If set, all new users receive this `native_language` and the frontend hides the selector. |
| `ALLOWED_ORIGINS` | `http://localhost:8081,http://localhost:19006,tauri://localhost,http://tauri.localhost` | Comma-separated CORS allow-list. Empty disables the CORS middleware. |
| `ANALYTICS_ENABLED` | `false` | Enables validated behavioral analytics JSON lines on stdout. |


## Enrichment (gloss origin)

Default origin is **WiktApi** (`internal/enrich/wiktapi.go`): on cache miss, the API calls `GET {ORIGIN_WIKTAPI_BASE_URL}/v1/en/word/{lemma}/translations`, keeps display-language glosses (e.g. Korean), and persists one sense per gloss. **No API key.** Data is Wiktionary/Kaikki (**CC BY-SA**).

- WiktApi miss / 404 / outage → `ErrUnavailable` → HTTP 503 unless an optional Gemini/OpenAI fallback is configured via `ENRICH_PRIMARY_*`.
- Optional legacy enrichers still implement `Enricher` for fallback only.
- Examples are not required on the gloss path.

### Non-English / missing glosses

- `503` on lookup miss usually means WiktApi had no entry (common for some multi-word phrases) and no legacy fallback key is set.
- `422 "localized translation unavailable for this word sense"` — add requires a cached display-language gloss on the chosen sense.

Enrichment is in-request and synchronous. A background queue is future scope.

**Client wait:** the shared API client (`packages/api`) uses a **60s** request timeout so slow WiktApi + optional Gemini fallback (often ~22s) can finish as HTTP 200 instead of aborting early as status `0` → ADD-101. Edge `proxy_read_timeout` / `proxy_send_timeout` for `pn.nacfson.cloud` should stay **≥ 60s** (see `deploy/NETWORK_SETUP.md`). Add-word / lookup may wait up to ~60s when enrichment is cold or slow; keep a loading state — do not treat that wait as a hard failure.

### Refresh existing meanings (retranslate-senses)

Rebuild glosses for words already in a user's learning set (or the whole catalog), remapping cards with AutoMatch:

```sh
set -a && source .env && set +a
go run ./cmd/retranslate-senses -email 'dev@project-pn.local' -dry-run
go run ./cmd/retranslate-senses -email 'dev@project-pn.local' -continue-on-error
```

Flags: `-user-id`, `-email`, `-word-id`, `-limit`, `-dry-run`, `-continue-on-error`. See `docs/backend-flows.md` (Retranslate-Senses Command).

## Learning analytics logs (optional)

When `LEARNING_LOG_DIR` is set to an absolute directory path, the API appends one key=value row per learning event to daily files named `YYYYMMDD_log` (UTC). Events include `learning_item_added`, `review_attempted`, `sense_changed`, and `learning_item_archived` (leech suspend). This is separate from `ADMIN_LOG_PATH` admin audit logs. Leave `LEARNING_LOG_DIR` empty to disable. Row format and fields are defined in `docs/superpowers/specs/2026-07-27-learning-daily-log-design.md`.

## Behavioral analytics (optional)

`ANALYTICS_ENABLED=false` is the local/test default. When explicitly enabled,
`POST /api/analytics/events` accepts validated batches of up to 100 versioned
events / 256 KiB and writes one structured stdout record per event with
`kind:"analytics"`. The platform Vector profile owns collection and routing;
see `docs/analytics-contract.md`. This stream is separate from both admin and
daily learning logs.

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

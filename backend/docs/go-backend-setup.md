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

## Staging deploy (`deploy/`)

For a private staging stack (PostgreSQL + migrate + API + nginx on plain HTTP `:80`), use the repo-root `deploy/` folder:

```sh
cp deploy/.env.example deploy/.env
# edit deploy/.env (DATABASE_URL, ALLOWED_ORIGINS, APP_PUBLIC_URL, POSTGRES_PASSWORD, …)
docker compose -f deploy/compose.yaml --env-file deploy/.env up -d --build
curl http://YOUR_SERVER_IP/readyz
```

Services:

| Service | Role |
|---------|------|
| `postgres` | PostgreSQL 16 with healthcheck; not published to the host |
| `migrate` | One-shot `./migrate up` from the backend image |
| `api` | Go API on internal `:8080` |
| `nginx` | Publishes `80:80`; reverse-proxies to `api` |

The backend image is built from `backend/Dockerfile`:

- Multi-stage build with **`CGO_ENABLED=0`** static binaries (`api`, `migrate`)
- Runtime: **`debian:bookworm-slim` + `ca-certificates`** (required for outbound HTTPS to Resend, Google token verification, and enrichment APIs — do not use a scratch/distroless runtime without bundled CA certs)
- Migrations copied to `/app/db/migrations`

TLS termination is **not** enabled in staging. See commented `:443` block in `deploy/nginx/nginx.conf` and `backend/docs/backend-future-scope.md`.

Local development continues to use `backend/compose.yaml` (PostgreSQL on host port `5433`) and `go run ./cmd/api`.

## Environment Variables

All variables are read by `internal/config/config.go`. Defaults match `.env.example`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_ADDR` | `:8080` | HTTP listen address for `cmd/api`. |
| `DATABASE_URL` | `postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable` | PostgreSQL connection string used by `db.Open` and the migrate CLI. |
| `MIGRATIONS_PATH` | `file://db/migrations` | golang-migrate source URL. Resolved relative to the `backend/` working directory. |
| `ENRICH_BASE_URL` | empty | Base URL of an OpenAI-compatible `/chat/completions` endpoint. Empty disables generation. |
| `ENRICH_API_KEY` | empty | Bearer token for the enricher. |
| `ENRICH_MODEL` | empty | Model name passed to the enricher. |
| `DEFAULT_USER_ID` | `00000000-0000-0000-0000-000000000001` | Seeded dev user id (migration `000002`); retained on `words.Service` for tests. Protected API routes derive the acting user from the bearer session, not this env var. |
| `DEFAULT_TARGET_LANG` | `en` | Default `target_language` on register when omitted; fallback when a request omits `language_code`. |
| `DEFAULT_DEFINITION_LANG` | `ko` | Default `native_language` on register when omitted; fallback when a request omits `definition_language_code`. |
| `ALLOWED_ORIGINS` | `http://localhost:8081,http://localhost:19006,tauri://localhost,http://tauri.localhost` | Comma-separated CORS allow-list. Empty disables the CORS middleware. |
| `SESSION_TTL` | `720h` | Bearer session lifetime. |
| `REQUIRE_EMAIL_VERIFIED` | `false` | When `true`, `POST /api/words/lookup` and `POST /api/learning-items` return 403 until `users.email_verified_at` is set. |
| `EMAIL_PROVIDER` | `log` | `log` prints magic-link URLs to API stdout; `resend` sends via Resend API. |
| `RESEND_API_KEY` | empty | Required when `EMAIL_PROVIDER=resend`. |
| `EMAIL_FROM` | empty | From address for Resend. |
| `APP_PUBLIC_URL` | `http://localhost:8080` | Base URL for magic-link consume redirects (`…/auth/callback#code=`). |
| `MAGIC_LINK_TTL` | `15m` | Magic-link token lifetime. |
| `EXCHANGE_CODE_TTL` | `5m` | Post-consume exchange code lifetime. |
| `GOOGLE_CLIENT_IDS` | empty | Comma-separated Google OAuth client IDs accepted as ID token audiences. |

## Enrichment

The `Enricher` interface lives in `internal/enrich/`. The current implementation (`OpenAIEnricher`) calls any OpenAI-compatible chat-completions endpoint (Groq, DeepSeek, Gemini's OpenAI shim, OpenAI, etc.).

- `ENRICH_BASE_URL` empty → `Enrich` returns `ErrNotConfigured`. The lookup endpoint returns HTTP 503 "word enrichment is not available; configure ENRICH_BASE_URL or add the sense manually" on a cache miss. Cache hits are unaffected.
- `ENRICH_BASE_URL` set + `ENRICH_API_KEY` set → enrichment runs synchronously inside the request and the result is persisted in the same transaction as the cache write.
- `ENRICH_MODEL` is required when an endpoint is configured.

Enrichment is currently in-request and synchronous. A background queue is future scope (see `backend/docs/backend-future-scope.md`).

## Tests

Run unit tests:

```sh
GOTOOLCHAIN=go1.26.0 go test ./...
```

Schema acceptance tests require `DATABASE_URL` and a running local PostgreSQL instance:

```sh
docker compose up -d
DATABASE_URL=postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable GOTOOLCHAIN=go1.26.0 go test ./...
```

`internal/migrations/schema_acceptance_test.go` runs the acceptance scenarios in `backend/docs/backend-acceptance-tests.md` against a freshly migrated database. `internal/http/auth_handler_test.go`, `internal/http/words_handler_test.go`, and `internal/http/router_test.go` cover the HTTP layer (auth, validation, health endpoints, CORS, protected routes).

The MVP schema source of truth is `backend/docs/backend-schema-mvp.md`. Learning and review rules are in `backend/docs/learning-review-model.md`.

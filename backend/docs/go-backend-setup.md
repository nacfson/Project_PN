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

## Public Docker deploy (`deploy/`)

Detailed deployment steps and troubleshooting live in `backend/docs/remote-deploy-runbook.md`.

For a public Docker-only stack on `zlUbuntu` (PostgreSQL + migrate + API + nginx with HTTPS), use `scripts/deploy-remote.sh` from the repo root. The script builds the backend image locally, uploads it to the remote server over SSH/SCP, loads it with Docker, and starts the remote compose stack.

```sh
DEPLOY_HOST=user@YOUR_SERVER_IP scripts/deploy-remote.sh
```

Or create a local deploy environment file and run the script without inline variables:

```sh
cp deploy/.deploy.env.example deploy/.deploy.env
# edit DEPLOY_HOST to match a ~/.ssh/config host alias, for example project-pn
scripts/deploy-remote.sh
```

Optional script inputs:

```sh
DEPLOY_ENV_FILE=deploy/.deploy.env
DEPLOY_PUBLIC_URL=https://YOUR_PUBLIC_DOMAIN
DEPLOY_ACCESS_SCOPE=public
EXISTING_POSTGRES_PASSWORD=old-password
REMOTE_DIR=~/project-pn/deploy
IMAGE_NAME=project-pn-backend
IMAGE_TAG=$(git rev-parse --short HEAD)
PLATFORM=linux/amd64
```

For an internet-facing deploy, use a public domain or public IP and set
`DEPLOY_ACCESS_SCOPE=public`. The deploy script refuses private/local URLs
(`localhost`, `127.0.0.1`, `10.x.x.x`, `172.16.x.x`-`172.31.x.x`,
`192.168.x.x`) in public mode because those addresses only work on the same
machine or private network.

If the host is behind a router that does not forward public traffic to the
Ubuntu server, use router port-forwarding, a public cloud host, or a named
Cloudflare Tunnel for durable outside-intranet access. For temporary testing
only, `scripts/start-remote-quick-tunnel.sh` can start a TryCloudflare quick
tunnel after `QUICK_TUNNEL_ACK=public-test-only` is set.

On first run, the script uploads `deploy/.env.example` and creates a remote `.env` if one does not exist. It generates a Postgres password, sets `DATABASE_URL`, and uses `DEPLOY_PUBLIC_URL` for `ALLOWED_ORIGINS` and `APP_PUBLIC_URL`. The script never overwrites an existing remote `.env`.

If the remote Postgres volume was already initialized with an older password, set `EXISTING_POSTGRES_PASSWORD` in `deploy/.deploy.env`. The script will start Postgres, update the `project_pn` database user password to match the remote `.env`, then continue the deployment.

Services:

| Service | Role |
|---------|------|
| `postgres` | PostgreSQL 16 with healthcheck; not published to the host |
| `migrate` | One-shot `./migrate up` from the backend image |
| `api` | Go API on internal `:8080` |
| `nginx` | Publishes `80:80`; reverse-proxies to `api` |

On a remote server, only these deployment files and TLS certs are required:

- `deploy/compose.yaml`
- `deploy/.env`
- `deploy/nginx/nginx.conf`
- `deploy/certs/fullchain.pem`
- `deploy/certs/privkey.pem`

From the server's `deploy/` directory, deploy with:

```sh
docker compose --env-file .env up -d
curl https://YOUR_PUBLIC_DOMAIN/readyz
```

The primary deployment path does not require GHCR. `scripts/deploy-remote.sh` loads both `project-pn-backend:<git-short-sha>` and `project-pn-backend:latest` on the server, then supplies `BACKEND_IMAGE=project-pn-backend:<git-short-sha>` when it starts Docker Compose remotely.

The backend image contains:

- Multi-stage build with **`CGO_ENABLED=0`** static binaries (`api`, `migrate`)
- Runtime: **`debian:bookworm-slim` + `ca-certificates`** (required for outbound HTTPS to Resend, Google token verification, and enrichment APIs — do not use a scratch/distroless runtime without bundled CA certs)
- Migrations copied to `/app/db/migrations`

TLS termination is enabled in `deploy/nginx/nginx.conf`. Forward public `80/tcp` and `443/tcp` from the router to `zlUbuntu`, and keep `APP_PUBLIC_URL` / native build `EXPO_PUBLIC_API_BASE_URL` on the same HTTPS domain.

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
| `ALLOWED_TARGET_LANGS` | empty | Comma-separated ISO 639-1 codes users may select as `target_language`. Empty means unrestricted. |
| `ALLOWED_DEFINITION_LANGS` | empty | Comma-separated ISO 639-1 codes users may select as `native_language`. Empty means unrestricted. |
| `FORCE_TARGET_LANG` | empty | If set, all new users receive this `target_language` and the frontend hides the selector. |
| `FORCE_DEFINITION_LANG` | empty | If set, all new users receive this `native_language` and the frontend hides the selector. |
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

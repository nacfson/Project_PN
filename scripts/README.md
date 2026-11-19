# Operational & Developer Scripts

## Overview
Houses repository-level CLI scripts for local stack orchestration and verification, static TypeScript/RNTL linting, PostgreSQL S3 backup/restore and pipeline/identity migrations, GHCR cloud build dispatch, staging dictionary enrichment, and remote secret/worker tooling.

## Interface
- Local dev & verification:
  - `start-web-dev.sh [--skip-db] [--skip-migrate]` — boots Docker Compose Postgres, runs backend migrations, starts the Go API with `AUTH_DEV_BYPASS=true`, and runs `npm run web` `[start-web-dev.sh:usage]`
  - `verify-local.sh [--full]` — runs stack health probes (`env-files`, `db-reachable`, `backend-alive`, `backend-ready`, `client-up`, `client-to-backend`) and, with `--full`, lint, typechecks, and frontend/api/backend test suites `[verify-local.sh:run_check]`
  - `seed-dev-guest.sh` & `seed-dev-guest.sql` — local-only guard wrapper and SQL script marking fixed dev UUID `00000000-0000-0000-0000-000000000001` verified in `users` and inserting its `user_identities` row `[seed-dev-guest.sh:DATABASE_URL]` `[seed-dev-guest.sql:IS_LOCAL]`
- Static linters:
  - `lint-imports.mjs [paths...]` — TypeScript AST checker (`checkFile`, `walk`) verifying relative `import`/`export`/`import()`/`require()` specifiers resolve to files across `frontend`, `browser-extension`, and `packages` `[lint-imports.mjs:checkFile]`
  - `lint-rntl-async.mjs [paths...]` — TypeScript AST checker (`checkFile`, `collectHelpers`, `isCallToAsyncRntl`) ensuring `@testing-library/react-native` v14 async calls and local wrapper helpers are awaited/returned in `*.test.*` files `[lint-rntl-async.mjs:checkFile]`
- Database backup, restore & migrations:
  - `db-dump-to-s3.sh [--skip-upload] [--keep-local DIR] [--upload-file PATH] [--compress gzip|zstd|none] [--encrypt] [--allow-remote] [--list]` — creates custom-format `pg_dump` backups with SHA-256 sidecars and optional `age` encryption/S3 upload `[db-dump-to-s3.sh:usage]`
  - `db-restore-from-s3.sh (--s3-uri URI | --file PATH | --latest | --list) [--mode full|data] [--force] [--yes] [--migrate] [--allow-remote]` — verifies checksums, decrypts/decompresses, and restores into `DATABASE_URL` `[db-restore-from-s3.sh:usage]`
  - `migrate-local-dump-to-pipeline.sh <dump-archive>` — restores a local `.tar.gz`/`.dump.gz`/`.sql`/`.dump` file into pipeline Postgres (`TARGET_DB`, default `proj_pn`) and reassigns ownership to `OWNER_ROLE` (`user_pn`) `[migrate-local-dump-to-pipeline.sh:DUMP_PATH]`
  - `migrate-platform-identities.sql` — transactional SQL template upserting a Keycloak `(issuer, subject)` binding in `user_identities` for an existing `users` row matched by `lower(email)` `[migrate-platform-identities.sql:user_identities]`
- CI/CD, staging & worker utilities:
  - `push-ghcr.sh [--cloud] [--watch] [--ref <git-ref>]` — dispatches GitHub Actions `publish-ghcr-images.yml` for `TARGET=all|backend|frontend` `[push-ghcr.sh:usage]`
  - `push-and-watch.sh` — pushes `main` to `origin`, watches the `"Publish Project PN images"` workflow run via `gh`, and prints expected GHCR image tags `[push-and-watch.sh:RUN_ID]`
  - `dictionary_enricher.py` — standalone staging HTTP server (`0.0.0.0:8787`) serving `GET /healthz` and `POST /chat/completions` (`Handler`, `dictionary_entries`, `translate_prompt`, `translate`) backed by `api.dictionaryapi.dev` and `translate.googleapis.com` `[dictionary_enricher.py:Handler]`
  - `sync-auth-google-secrets.sh` — SSH helper updating `auth-oauth-secrets` and `auth-bootstrap` Kubernetes secrets in namespace `nacfson-auth` and restarting `deploy/auth-service` `[sync-auth-google-secrets.sh:patch_secret]`
  - `start-cursor-worker.sh` — launches `agent worker start` for `CURSOR_WORKER_NAME` (default `project-pn-mac`) rooted at the repo `[start-cursor-worker.sh:WORKER_NAME]`
  - `sync-docs-on-deploy.sh` — no-op shell hook returning exit status `0` `[sync-docs-on-deploy.sh:exit]`
- [lib](./lib/README.md) — Shared Bash helpers (`db-s3-common.sh`) for S3 backup and restore scripts

## Invariants
- `verify-local.sh` intentionally accepts only `--full` (and `-h`/`--help`) with no skip flags, exiting `0` on full pass, `1` on any check failure, or `2` on invalid arguments/missing `curl` `[verify-local.sh:FULL]`
- `seed-dev-guest.sh` aborts unless `PN_ENV=local` or `APP_ENV=local` and rejects any `DEPLOY_ENV`/`ENV` matching `production|staging|prod|deploy`; `seed-dev-guest.sql` independently raises a SQL exception if psql variable `IS_LOCAL` is unset or falsy `[seed-dev-guest.sh:DEPLOY_ENV]` `[seed-dev-guest.sql:IS_LOCAL]`
- `push-ghcr.sh` rejects `--local` (`BUILD_MODE != cloud`) because local image builds are retired, validates `TARGET` in `backend|frontend|all`, and aborts on detached `HEAD` unless `--ref`/`GIT_REF` is provided `[push-ghcr.sh:BUILD_MODE]` `[push-ghcr.sh:TARGET]`
- `db-restore-from-s3.sh` requires exactly one source (`--s3-uri`, `--file`, or `--latest`), validates `--mode` in `full|data`, refuses to overwrite non-empty `public` schemas in `full` mode without `--force`, and excludes `schema_migrations` in `data` mode `[db-restore-from-s3.sh:MODE]` `[db-restore-from-s3.sh:FORCE]`
- `migrate-platform-identities.sql` never truncates tables or grants admin roles, raises an exception if the target email is missing from `users`, and upserts strictly on `(issuer, subject)` `[migrate-platform-identities.sql:user_identities]`
- `sync-auth-google-secrets.sh` requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SSH_PRIVATE_KEY`, and `DEPLOY_SSH_HOST`, logs only string lengths (never secret values), and creates the temporary SSH key with `chmod 600` `[sync-auth-google-secrets.sh:CLIENT_ID]`
- `dictionary_enricher.py` restricts part-of-speech parsing to `VALID_POS`, truncates `short_definition` at 80 characters, returns at most 3 entries per lookup, and synthesizes a fallback entry when upstream dictionary lookup fails `[dictionary_enricher.py:VALID_POS]` `[dictionary_enricher.py:dictionary_entries]`

## Side Effects
- `start-web-dev.sh` copies `.env.example` into missing `backend/.env` and `frontend/.env`, starts Docker Compose Postgres, runs DB migrations, spawns background `go run ./cmd/api` (terminated via `EXIT`/`INT`/`TERM` trap), and launches Expo web `[start-web-dev.sh:cleanup]`
- `verify-local.sh` parses `backend/.env` and `frontend/.env`, opens TCP sockets to Postgres/web ports, sends HTTP requests to `/healthz`, `/readyz`, `:8081`, and `/api/decks`, and under `--full` executes npm linters, typechecks, Jest suites, and `go test -p 1 ./...` `[verify-local.sh:tcp_open]` `[verify-local.sh:run_check]`
- `db-dump-to-s3.sh`, `db-restore-from-s3.sh`, `migrate-local-dump-to-pipeline.sh`, `seed-dev-guest.sh`, and `migrate-platform-identities.sql` read/write temporary directories and local backup files, transfer S3 objects, and execute `pg_dump`, `pg_restore`, `psql`, and `go run ./cmd/migrate up` against PostgreSQL `[db-dump-to-s3.sh:WORKDIR]` `[db-restore-from-s3.sh:WORKDIR]` `[migrate-local-dump-to-pipeline.sh:PG_ARGS]`
- `push-ghcr.sh` and `push-and-watch.sh` push git refs (`git push origin main`) and trigger/watch GitHub Actions runs via `gh` `[push-ghcr.sh:GIT_REF]` `[push-and-watch.sh:RUN_ID]`
- `sync-auth-google-secrets.sh` writes a temporary SSH key file (removed on `EXIT` trap), opens an SSH connection to `DEPLOY_SSH_HOST`, mutates Kubernetes secrets via `kubectl`, and restarts `deploy/auth-service` `[sync-auth-google-secrets.sh:TMP_KEY]`
- `dictionary_enricher.py` binds TCP `0.0.0.0:8787` and makes outbound HTTPS requests to `api.dictionaryapi.dev` and `translate.googleapis.com` `[dictionary_enricher.py:fetch_json]`
- `start-cursor-worker.sh` replaces the shell process via `exec agent worker start` `[start-cursor-worker.sh:WORKER_NAME]`
- `lint-imports.mjs` and `lint-rntl-async.mjs` walk workspace source trees on disk and terminate with `process.exit(0)` or `process.exit(1)` `[lint-imports.mjs:walk]` `[lint-rntl-async.mjs:walk]`

## Verification
- Run: `npm run lint && npm run verify`

# Central Auth API Entrypoint

## Overview
Executable `main` package for the `central-auth` HTTP authentication service. On startup it loads runtime configuration from environment variables, applies pending PostgreSQL SQL migrations, opens a `pgxpool` database pool, wires `session.Service`, `oauth.GoogleService`, and the `httpapi` Chi router, serves HTTP requests, and handles graceful shutdown on `SIGINT`/`SIGTERM`.

## Interface
- `[main.go:main]` — Binary entrypoint initializing config, schema migrations, DB pool, services, HTTP server (`ReadHeaderTimeout: 5s`), and signal-driven graceful shutdown (`10s` timeout).
- `[main.go:runMigrations]` — Internal startup helper executing `golang-migrate` `Up()` migrations from `cfg.MigrationsPath` against `cfg.DatabaseURL`.
- `[main.go:hasScheme]` — Internal helper testing whether a migration path starts with `file://`.

## Invariants
- `cfg.DatabaseURL` must be non-empty; otherwise the process logs an error and exits with status `1` `[main.go:main]`.
- Migrations must complete without error (ignoring `migrate.ErrNoChange`) and the database pool must open before the HTTP server begins listening `[main.go:main]`, `[main.go:runMigrations]`.
- Relative `cfg.MigrationsPath` values without a `file://` prefix are normalized to `file://<cwd>/db/migrations` `[main.go:runMigrations]`, `[main.go:hasScheme]`.
- The HTTP server enforces a 5-second `ReadHeaderTimeout` and drains active connections with a 10-second timeout upon receiving `SIGINT` or `SIGTERM` `[main.go:main]`.

## Side Effects
- Reads process environment variables via `config.Load()` `[main.go:main]`.
- Reads the working directory (`os.Getwd()`) and migration SQL files from disk, then executes DDL/DML migrations against PostgreSQL via `migrate.New` and `m.Up()` `[main.go:runMigrations]`.
- Opens and closes a PostgreSQL connection pool via `db.Open` `[main.go:main]`.
- Binds TCP address `cfg.Addr` and serves HTTP traffic via `http.Server.ListenAndServe` `[main.go:main]`.
- Registers OS signal handlers for `syscall.SIGINT` and `syscall.SIGTERM` via `signal.Notify` `[main.go:main]`.
- Emits structured logs via `slog` and terminates the process with `os.Exit(1)` on fatal startup or server errors `[main.go:main]`.

## Verification
- Run: `cd central-auth && go test ./...`

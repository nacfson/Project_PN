# backend/cmd/migrate

## Overview
Standalone CLI wrapper over `project-pn/internal/migrations` for applying pending PostgreSQL migrations (`up`), rolling back migrations (`down`), or inspecting the current schema version and dirty flag (`version`).

## Interface
- `main()` `[main.go:main]` — Parses the `-steps` flag (default `1`) and positional command (`up` [default], `down`, `version`) and delegates to `migrations.Up`, `migrations.Down`, or `migrations.Version` using `cfg.MigrationsPath` and `cfg.DatabaseURL`.
- `version` `[main.go:version]` — Build-time version string variable defaulting to `"v0.0.0"`.

## Invariants
- Omitting a positional argument defaults the command to `"up"` `[main.go:main]`.
- When running `"down"`, `-steps` must be `>= 1`; non-positive values log an error and exit with code `1` `[main.go:main]`.
- Unknown command names are rejected with an error log and exit code `1` `[main.go:main]`.

## Side Effects
- Reads environment configuration via `config.Load()` and parses CLI flags via `flag.Parse()` `[main.go:main]`.
- Executes PostgreSQL schema migrations (`migrations.Up`, `migrations.Down`) or queries migration state (`migrations.Version`) against `cfg.DatabaseURL` `[main.go:main]`.
- Prints `version=%d dirty=%t\n` to `os.Stdout` for the `version` command, writes structured error logs to `os.Stderr`, and exits with code `1` on failure `[main.go:main]`.

## Verification
- Run: `cd backend && go run ./cmd/migrate up`
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`

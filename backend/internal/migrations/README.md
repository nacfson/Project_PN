# Migrations

## Overview
Thin wrapper around `golang-migrate/migrate/v4` for applying, rolling back, and inspecting file-based PostgreSQL schema migrations.

## Interface
- `Up(sourceURL, databaseURL string) error` `[migrations.go:Up]`
- `Down(sourceURL, databaseURL string, steps int) error` `[migrations.go:Down]`
- `Version(sourceURL, databaseURL string) (uint, bool, error)` `[migrations.go:Version]`

## Invariants
- `Up` treats `migrate.ErrNoChange` as success (`nil`) `[migrations.go:Up]`.
- `Down` applies `-steps` and treats both `migrate.ErrNoChange` and `migrate.ErrNilVersion` as success (`nil`) `[migrations.go:Down]`.
- `Version` maps `migrate.ErrNilVersion` to `(0, false, nil)` `[migrations.go:Version]`.
- Every operation closes the underlying `migrate.Migrate` instance via `defer closeMigration(m)` `[migrations.go:closeMigration]`.

## Side Effects
- Registers the `golang-migrate` `postgres` database driver and `file` source driver via blank imports `[migrations.go:Up]`.
- Reads migration SQL files from `sourceURL` and connects to PostgreSQL at `databaseURL` to execute DDL statements and update/query the `schema_migrations` table `[migrations.go:Up]`, `[migrations.go:Down]`, `[migrations.go:Version]`.

## Verification
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/migrations` (full suite: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`)

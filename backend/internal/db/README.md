# DB

## Overview
Configures and opens the PostgreSQL `pgxpool.Pool` with connection lifetime and health-check caps designed to recycle connections well before the platform `vault-db-proxy` 15-minute cutoff.

## Interface
- `DefaultMaxConnLifetime` (`5m`), `DefaultMaxConnLifetimeJitter` (`30s`), `DefaultMaxConnIdleTime` (`2m`), `DefaultHealthCheckPeriod` (`30s`) `[pool.go:DefaultMaxConnLifetime]`, `[pool.go:DefaultMaxConnLifetimeJitter]`, `[pool.go:DefaultMaxConnIdleTime]`, `[pool.go:DefaultHealthCheckPeriod]`
- `ParsePoolConfig(databaseURL string) (*pgxpool.Config, error)` `[pool.go:ParsePoolConfig]`
- `Open(ctx context.Context, databaseURL string) (*pgxpool.Pool, error)` `[pool.go:Open]`

## Invariants
- `ParsePoolConfig` unconditionally sets `MaxConnLifetime = 5m`, `MaxConnLifetimeJitter = 30s`, `MaxConnIdleTime = 2m`, and `HealthCheckPeriod = 30s` on every parsed `pgxpool.Config` `[pool.go:ParsePoolConfig]`.
- `Open` verifies connectivity with a 5-second timeout `pool.Ping` and closes the pool on failure before returning an error `[pool.go:Open]`.

## Side Effects
- Establishes PostgreSQL network connections via `pgxpool.NewWithConfig` and issues an initial `Ping` query against `databaseURL` `[pool.go:Open]`.

## Verification
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/db` (full suite: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`)

# Central Auth Database Pool

## Overview
PostgreSQL connection pool initializer for `central-auth` built on `github.com/jackc/pgx/v5/pgxpool`.

## Interface
- `[db.go:Open]` — Parses `databaseURL`, initializes a `*pgxpool.Pool`, pings PostgreSQL to verify reachability, and returns the live pool.

## Invariants
- Returns a non-nil `*pgxpool.Pool` only if `pgxpool.ParseConfig`, `pgxpool.NewWithConfig`, and `pool.Ping(ctx)` all succeed; on `Ping` failure, the pool is closed before returning the wrapped error `[db.go:Open]`.

## Side Effects
- Opens PostgreSQL network connections via `pgxpool.NewWithConfig` and executes a `Ping` network round-trip against the target database `[db.go:Open]`.

## Verification
- Run: `cd central-auth && go test ./...`

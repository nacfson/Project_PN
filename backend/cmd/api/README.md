# backend/cmd/api

## Overview
Main HTTP API server entrypoint (`pn-api`) for Project PN. On startup it configures structured JSON logging, validates database configuration, executes pending PostgreSQL migrations, initializes the database pool, gloss enrichment pipeline (WiktApi primary with optional OpenAI-compatible LLM fallback), Keycloak/gateway JWT verification and legacy auth clients, core `auth` and `words` services, metrics/analytics/learning loggers, and an optional Expo push notification worker before serving the HTTP router with graceful shutdown.

## Interface
- `main()` `[main.go:main]` — Process entrypoint wiring `config.Load()`, `migrations.Up(...)`, `db.Open(...)`, `enrich.NewWiktAPI` / `enrich.NewFallback`, `auth.NewJWTVerifier`, optional `auth.NewCentralClientWithInternalAuth` and `auth.NewGatewayClient`, `auth.New`, `words.New`, `httpapi.NewRouter`, optional `notify.Worker`, and `http.Server.ListenAndServe`.
- `version` `[main.go:version]` — Build-time version string variable defaulting to `"v0.0.0"`.

## Invariants
- `cfg.DatabaseURL` must be non-empty; startup terminates with exit code `1` otherwise `[main.go:main]`.
- `migrations.Up` must succeed before opening the application `pgxpool` or starting the HTTP server; any migration error exits with code `1` `[main.go:main]`.
- `http.Server.ReadHeaderTimeout` is fixed at `5 * time.Second` `[main.go:main]`.
- Gloss enrichment always uses `enrich.NewWiktAPI` as primary and adds `enrich.NewOpenAI` behind `enrich.NewFallback` only when `cfg.EnrichPrimaryBaseURL != ""` `[main.go:main]`.
- `auth.CentralClient` is constructed only when `cfg.CentralAuthURL` or `cfg.CentralAuthInternalURL` is non-empty; `auth.GatewayClient` is constructed only when `cfg.GatewayAuthURL != ""` `[main.go:main]`.
- Graceful shutdown cancels the notification worker context and enforces a `10 * time.Second` deadline on `server.Shutdown` `[main.go:main]`.

## Side Effects
- Reads runtime configuration from environment variables via `config.Load()` `[main.go:main]`.
- Applies PostgreSQL schema migrations (`migrations.Up`) and opens a PostgreSQL connection pool (`db.Open`) `[main.go:main]`.
- Writes structured service logs to `os.Stderr` (`logx.New`), optional JSON analytics events to `os.Stdout` when `cfg.AnalyticsEnabled` is true, admin audit logs via `admin.NewLogger()`, and learning log files under `cfg.LearningLogDir` via `learninglog.NewLogger` `[main.go:main]`.
- Spawns a background goroutine flushing `MetricsCollector` to `adminLogger` every `60 * time.Second` and, when `cfg.NotificationWorkerEnabled` is true, spawns `notify.Worker.Run` to dispatch Expo push notifications `[main.go:main]`.
- Binds TCP listener on `cfg.AppAddr` (`server.ListenAndServe`), traps `os.Interrupt` and `syscall.SIGTERM`, and calls `os.Exit(1)` on fatal startup, server, or shutdown errors `[main.go:main]`.

## Verification
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`

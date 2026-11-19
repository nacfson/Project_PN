# Config

## Overview
Loads and normalizes runtime configuration for the Go backend API, database connectivity, dictionary/enrichment providers, CORS origins, language constraints, authentication/JWT verification, notification worker, and logging from process environment variables.

## Interface
- `Config` struct containing server, database, migration, enrichment, language, CORS, gateway/JWT/central auth, notification worker, learning log, and analytics settings `[config.go:Config]`
- `Load() Config` `[config.go:Load]`

## Invariants
- `resolveDatabaseURL` prefers an explicit `DATABASE_URL`; only when `DATABASE_URL` is empty and `DB_HOST` is set does it assemble a `postgres://` URL from `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_TOKEN` with `sslmode=disable` `[config.go:resolveDatabaseURL]`.
- `EnrichPrimaryModel` is populated only when `EnrichPrimaryBaseURL` is non-empty, defaulting to `"gemini-3.1-flash-lite"` `[config.go:Load]`.
- `AuthJWTAllowedAlgs` always contains at least one algorithm, defaulting to `[]string{"RS256"}` when `AUTH_JWT_ALLOWED_ALGS` parses empty `[config.go:Load]`.
- `buildAllowedOrigins` appends `chrome-extension://<id>` entries for non-empty `PN_DEV_EXTENSION_ID` and `PN_PROD_EXTENSION_ID` without mutating the base slice `[config.go:buildAllowedOrigins]`.
- Invalid durations or unrecognized boolean strings fall back to their configured defaults `[config.go:durationOrDefault]`, `[config.go:envBool]`.

## Side Effects
- Reads environment variables via `os.Getenv`: `APP_ADDR`, `DATABASE_URL`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_TOKEN`, `MIGRATIONS_PATH`, `ORIGIN_WIKTAPI_BASE_URL`, `ENRICH_PRIMARY_BASE_URL`, `ENRICH_BASE_URL`, `ENRICH_PRIMARY_MODEL`, `ENRICH_MODEL`, `DEFAULT_USER_ID`, `DEFAULT_TARGET_LANG`, `DEFAULT_DEFINITION_LANG`, `ALLOWED_TARGET_LANGS`, `ALLOWED_DEFINITION_LANGS`, `FORCE_TARGET_LANG`, `FORCE_DEFINITION_LANG`, `DEFAULT_UI_LANGUAGE`, `ALLOWED_UI_LANGUAGES`, `FORCE_UI_LANGUAGE`, `ALLOWED_ORIGINS`, `PN_DEV_EXTENSION_ID`, `PN_PROD_EXTENSION_ID`, `SIGN_IN`, `GATEWAY_AUTH_URL`, `CENTRAL_AUTH_URL`, `CENTRAL_AUTH_INTERNAL_URL`, `AUTH_SESSION_INTERNAL_TOKEN`, `PUBLIC_APP_URL`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, `AUTH_JWT_JWKS_URL`, `AUTH_JWT_ALLOWED_ALGS`, `AUTH_JWT_CLOCK_SKEW`, `AUTH_DEV_BYPASS`, `NOTIFICATION_WORKER_ENABLED`, `NOTIFICATION_WORKER_INTERVAL`, `EXPO_ACCESS_TOKEN`, `LEARNING_LOG_DIR`, and `ANALYTICS_ENABLED` `[config.go:Load]`, `[config.go:resolveDatabaseURL]`.

## Verification
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/config` (full suite: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`)

# Central Auth Config

## Overview
Environment-based runtime configuration package for `central-auth`. Parses server binding, PostgreSQL connection and migration paths, session/token lifetimes, Google OAuth credentials, and admin email allowlists into a typed `Config` value with fallback defaults.

## Interface
- `[config.go:Config]` — Configuration struct containing `Addr`, `DatabaseURL`, `MigrationsPath`, `SessionInternalToken`, `CookieDomain`, `AccessTokenTTL`, `RefreshTokenTTL`, `SessionIdleTimeout`, `SessionMaxAge`, `PublicBaseURL`, `GoogleClientID`, `GoogleClientSecret`, `GoogleRedirectURI`, and `AdminEmails`.
- `[config.go:Load]` — Reads environment variables, applies defaults and normalization, and returns a populated `Config`.
- `[config.go:Config.GoogleConfigured]` — Returns `true` when both `GoogleClientID` and `GoogleClientSecret` are non-empty.
- `[config.go:Config.IsAdminEmail]` — Performs case-insensitive, whitespace-trimmed membership check against `Config.AdminEmails`.

## Invariants
- `PublicBaseURL` has trailing `/` characters stripped; if `GOOGLE_REDIRECT_URI` is blank, `GoogleRedirectURI` is derived as `PublicBaseURL + "/auth/google/callback"` `[config.go:Load]`.
- `AdminEmails` splits comma-separated values, trims whitespace, lowercases entries, and omits blanks (defaulting `ADMIN_EMAILS` to `"nacfson@gmail.com"`) `[config.go:Load]`, `[config.go:Config.IsAdminEmail]`.
- Duration settings (`ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `SESSION_IDLE_TIMEOUT`, `SESSION_MAX_AGE`) parse either integer seconds or Go `time.ParseDuration` strings, falling back to defaults (`1h`, `90d`, `7d`, `30d`) on empty or invalid values `[config.go:Load]`, `[config.go:durationEnv]`.
- `GoogleConfigured()` is `true` only when both `GoogleClientID` and `GoogleClientSecret` are non-empty `[config.go:Config.GoogleConfigured]`.

## Side Effects
- Reads process environment variables via `os.Getenv`: `PUBLIC_BASE_URL`, `GOOGLE_REDIRECT_URI`, `ADMIN_EMAILS`, `APP_ADDR`, `DATABASE_URL`, `MIGRATIONS_PATH`, `AUTH_SESSION_INTERNAL_TOKEN`, `COOKIE_DOMAIN`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `SESSION_IDLE_TIMEOUT`, `SESSION_MAX_AGE`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` `[config.go:Load]`, `[config.go:env]`, `[config.go:durationEnv]`.

## Verification
- Run: `cd central-auth && go test ./...`

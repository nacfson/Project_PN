# Central Auth Session Service

## Overview
PostgreSQL-backed user and session lifecycle package for `central-auth`. Issues opaque access tokens, refresh tokens, and optional cookie session values; validates bearer tokens; validates and slides expiry for cookie sessions; rotates refresh tokens with single-use revocation; and revokes sessions by access token or cookie value.

## Interface
- `[service.go:ErrInvalidToken]` — Sentinel error for missing, unknown, expired, or revoked sessions and blank emails.
- `[service.go:ErrNotFound]` — Sentinel error returned when a queried user record does not exist.
- `[service.go:User]` — User record struct (`ID`, `Email`, `IsAdmin`).
- `[service.go:Credentials]` — Newly issued raw session credentials (`AccessToken`, `RefreshToken`, `CookieValue`, `ExpiresAt`).
- `[service.go:Session]` — Persisted session state including `User`, `AuthProvider`, `ProviderSubject`, token hashes, `CookieValue`, expiry timestamps, `LoginAt`, and `RevokedAt`.
- `[service.go:Service]` — Session manager backed by `*pgxpool.Pool` and `config.Config`.
- `[service.go:NewService]` — Constructs `*Service`.
- `[service.go:Service.EnsureUser]` — Normalizes `email` (trimmed lowercase) and upserts a row in `users`.
- `[service.go:Service.CreateSessionForUser]` — Generates fresh opaque credentials and persists a new `sessions` row.
- `[service.go:Service.ValidateAccess]` — Looks up a session by SHA-256 hash of `accessToken` and verifies it is active and unexpired.
- `[service.go:Service.ValidateCookie]` — Looks up a session by `cookieValue`, verifies it is active and unexpired, and applies sliding expiration.
- `[service.go:Service.Refresh]` — Validates `refreshToken`, revokes the existing session, and creates a replacement session preserving cookie mode and provider metadata.
- `[service.go:Service.RevokeAccess]` — Marks an active session revoked by `access_token_hash`.
- `[service.go:Service.RevokeCookie]` — Marks an active session revoked by `cookie_value`.

## Invariants
- Access and refresh tokens are persisted only as SHA-256 hex digests (`token.Hash`), while `cookie_value` is stored directly (or as SQL `NULL` via `nullif($4, '')` when `issueCookie` is `false`) `[service.go:Service.createSession]`, `[service.go:Service.ValidateAccess]`, `[service.go:Service.ValidateCookie]`.
- `ValidateAccess` and `ValidateCookie` reject any session where `RevokedAt != nil` or `!AccessExpiresAt.After(time.Now())` with `ErrInvalidToken` `[service.go:Service.ValidateAccess]`, `[service.go:Service.ValidateCookie]`.
- `Refresh` rejects any session where `RevokedAt != nil` or `!RefreshExpiresAt.After(time.Now())`, revokes the prior session row before inserting a new one, and defaults an empty `AuthProvider` to `"magic_link"` with `providerSubject = session.User.ID` `[service.go:Service.Refresh]`.
- `slideSession` caps the extended `access_expires_at` at `min(now + SessionIdleTimeout, LoginAt + SessionMaxAge)` and avoids updating the database when the candidate deadline is not strictly after the current `AccessExpiresAt` `[service.go:Service.slideSession]`.
- `EnsureUser` rejects empty/whitespace-only emails with `ErrInvalidToken` `[service.go:Service.EnsureUser]`.
- `scanSession` maps `pgx.ErrNoRows` to `ErrInvalidToken` `[service.go:Service.scanSession]`.

## Side Effects
- Inserts and selects rows in PostgreSQL table `users` `[service.go:Service.EnsureUser]`, `[service.go:Service.getUserByID]`.
- Inserts, selects (joined with `users`), and updates (`access_expires_at`, `revoked_at`) rows in PostgreSQL table `sessions` `[service.go:Service.createSession]`, `[service.go:Service.slideSession]`, `[service.go:Service.Refresh]`, `[service.go:Service.RevokeAccess]`, `[service.go:Service.RevokeCookie]`, `[service.go:Service.scanSession]`.
- Draws cryptographic entropy via `token.Generate()` and reads system wall-clock time via `time.Now()` `[service.go:Service.createSession]`, `[service.go:Service.ValidateAccess]`, `[service.go:Service.ValidateCookie]`, `[service.go:Service.Refresh]`, `[service.go:Service.slideSession]`.

## Verification
- Run: `cd central-auth && go test ./...`

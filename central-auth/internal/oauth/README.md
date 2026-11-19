# Central Auth Google OAuth

## Overview
Google OAuth 2.0 authentication service for `central-auth`. Manages single-use CSRF state tokens in PostgreSQL, exchanges authorization codes with Google, fetches and validates Google UserInfo profiles, provisions or links users and `user_identities`, and mints authenticated sessions through `session.Service`.

## Interface
- `[google.go:ProviderGoogle]` — Provider identifier constant (`"google"`).
- `[google.go:OAuthStateTTL]` — State token lifetime constant (`10 * time.Minute`).
- `[google.go:ErrInvalidState]` — Sentinel error for missing, unknown, or expired OAuth state values.
- `[google.go:ErrGoogleNotConfigured]` — Sentinel error returned when Google OAuth client credentials are not configured.
- `[google.go:Identity]` — Authenticated external identity struct (`Provider`, `ProviderSubject`).
- `[google.go:CompleteResult]` — OAuth completion result containing `Credentials`, `User`, `Identity`, and `RedirectURL`.
- `[google.go:GoogleService]` — Service coordinating `pgxpool.Pool`, `config.Config`, `*oauth2.Config`, and `*session.Service`.
- `[google.go:NewGoogleService]` — Initializes `*GoogleService`, configuring `golang.org/x/oauth2` with `google.Endpoint` and scopes `openid`, `email`, `profile` when `cfg.GoogleConfigured()` is true.
- `[google.go:GoogleService.Configured]` — Returns whether Google OAuth is enabled (`g.oauth != nil`).
- `[google.go:GoogleService.Start]` — Generates a random state token, persists its SHA-256 hash in `oauth_states`, and returns the Google authorization URL (`oauth2.AccessTypeOnline`).
- `[google.go:GoogleService.Complete]` — Consumes OAuth state, exchanges `code`, verifies Google profile, provisions/links the user, and creates a session via `session.Service.CreateSessionForUser`.

## Invariants
- `Start` and `Complete` return `ErrGoogleNotConfigured` whenever `!g.Configured()` `[google.go:GoogleService.Start]`, `[google.go:GoogleService.Complete]`.
- OAuth state is single-use and expires after `OAuthStateTTL` (`10m`): `consumeState` atomically runs `delete from oauth_states where state_hash = $1 and expires_at > now() returning redirect_url`, returning `ErrInvalidState` on empty state or `pgx.ErrNoRows` `[google.go:GoogleService.consumeState]`.
- Google UserInfo responses must return HTTP 2xx, `email_verified: true`, and non-empty `sub` and `email` (trimmed and lowercased); unverified or incomplete profiles fail with `session.ErrInvalidToken` `[google.go:fetchGoogleProfile]`, `[google.go:GoogleService.Complete]`.
- `ensureGoogleUser` runs in a PostgreSQL transaction: it resolves an existing `(provider='google', provider_subject)` identity first, otherwise matches an existing user by `lower(email)` (promoting `is_admin = true` if listed in `cfg.IsAdminEmail`) or inserts a new `users` row, and upserts `user_identities` `[google.go:GoogleService.ensureGoogleUser]`.
- Cookie issuance is requested only when `redirectURL` is empty or parses with scheme `http` or `https` `[google.go:shouldIssueCookieForRedirect]`, `[google.go:GoogleService.Complete]`.

## Side Effects
- Inserts/upserts and deletes rows in PostgreSQL table `oauth_states` `[google.go:GoogleService.Start]`, `[google.go:GoogleService.consumeState]`.
- Queries, inserts, and updates PostgreSQL tables `users` and `user_identities` inside a transaction `[google.go:GoogleService.ensureGoogleUser]`.
- Sends outbound HTTPS requests to Google's OAuth2 token endpoint (`oauth2.Config.Exchange`) and `GET https://www.googleapis.com/oauth2/v3/userinfo` (`http.DefaultClient`) `[google.go:GoogleService.Complete]`, `[google.go:fetchGoogleProfile]`.
- Inserts a new session row via `session.Service.CreateSessionForUser` `[google.go:GoogleService.Complete]`.

## Verification
- Run: `cd central-auth && go test ./...`

# Central Auth HTTP API

## Overview
HTTP transport and routing layer for `central-auth` built on `go-chi/chi/v5`. Serves the hosted HTML login page, Google OAuth start and callback handlers, bearer/cookie session inspection and revocation endpoints, refresh-token rotation, and the internal shared-secret cookie-session validation endpoint consumed by downstream services.

## Interface
- `[router.go:Server]` — HTTP handler container holding `*session.Service`, `*oauth.GoogleService`, and `config.Config`.
- `[router.go:NewRouter]` — Constructs an `http.Handler` (Chi router with `RequestID`, `RealIP`, and `Recoverer` middleware) exposing:
  - `GET /healthz` — Plain-text `200 ok` health check `[router.go:NewRouter]`.
  - `GET /login` — Renders the hosted HTML login page via `[router.go:Server.showLogin]`, `[login.go:renderLoginPage]`, and `[login.go:loginPageTmpl]`.
  - `GET /auth/google` — Starts Google OAuth login and redirects `302` to Google (or renders an error on the login page when unconfigured) `[router.go:Server.startGoogle]`.
  - `GET /auth/google/callback` — Completes Google OAuth callback, issues a `nacfson_session` cookie for HTTP(S) redirects or appends `token`, `refresh_token`, and `expires_at` query parameters for non-HTTP(S) redirects, and redirects `302` `[router.go:Server.completeGoogle]`.
  - `GET /api/auth/session` — Validates a Bearer access token and returns JSON `{expires_at, auth_provider, identity, user}` `[router.go:Server.getSession]`, `[router.go:sessionResponse]`.
  - `DELETE /api/auth/session` — Revokes the `nacfson_session` cookie (and clears it) or a Bearer access token, returning `204 No Content` `[router.go:Server.deleteSession]`.
  - `POST /api/auth/refresh` — Accepts JSON `{"refresh_token": "..."}`, rotates credentials, and returns `{token, refresh_token, expires_at}` `[router.go:Server.refreshSession]`, `[router.go:refreshResponse]`.
  - `GET /api/internal/cookie-session` — Authenticates downstream callers via `Authorization: Bearer <SessionInternalToken>`, validates and slides the `nacfson_session` cookie, and returns JSON `{user_id, email, is_admin, expires_at, auth_provider, identity}` `[router.go:Server.getCookieSession]`, `[router.go:cookieSessionResponse]`.

## Invariants
- `GET /api/internal/cookie-session` fails closed with `401` if `cfg.SessionInternalToken` is empty or does not match the request Bearer token `[router.go:Server.getCookieSession]`.
- `GET /auth/google/callback` requires non-empty `code` and `state` query parameters (`400` otherwise) and translates `oauth.ErrInvalidState` and `session.ErrInvalidToken` into `401` `[router.go:Server.completeGoogle]`.
- `shouldIssueCookie` returns `true` for blank or `http`/`https` redirect URLs and `false` for other schemes; `buildRedirectURL` appends `token`, `refresh_token`, and `expires_at` query parameters only when `issueCookie` is `false` `[router.go:shouldIssueCookie]`, `[router.go:buildRedirectURL]`.
- Session cookies are always configured with name `"nacfson_session"`, `Path: "/"`, `Domain: cfg.CookieDomain`, `Secure: true`, `HttpOnly: true`, and `SameSite: http.SameSiteLaxMode` `[router.go:setSessionCookie]`, `[router.go:clearSessionCookie]`.
- Blank `rd` redirect parameters default to `"/"` `[login.go:loginRedirectURL]`, `[router.go:Server.completeGoogle]`.
- When a session record has an empty `AuthProvider`, response builders default `auth_provider`/`identity.provider` to `oauth.ProviderGoogle` and `provider_subject` to `sess.User.ID` `[router.go:sessionResponse]`, `[router.go:cookieSessionResponse]`.
- `DELETE /api/auth/session` prioritizes the `nacfson_session` cookie before checking for a Bearer access token `[router.go:Server.deleteSession]`.

## Side Effects
- Sets or expires the `nacfson_session` cookie on the HTTP response via `http.SetCookie` `[router.go:setSessionCookie]`, `[router.go:clearSessionCookie]`.
- Invokes `oauth.GoogleService.Start` and `Complete`, triggering PostgreSQL writes and external Google OAuth/UserInfo HTTP calls `[router.go:Server.startGoogle]`, `[router.go:Server.completeGoogle]`.
- Invokes `session.Service` methods (`ValidateAccess`, `ValidateCookie`, `Refresh`, `RevokeCookie`, `RevokeAccess`), querying and mutating PostgreSQL `sessions` rows `[router.go:Server.getSession]`, `[router.go:Server.deleteSession]`, `[router.go:Server.refreshSession]`, `[router.go:Server.getCookieSession]`.
- Writes HTML pages, JSON payloads, and HTTP `302` redirects to `http.ResponseWriter` `[login.go:renderLoginPage]`, `[router.go:writeJSON]`.

## Verification
- Run: `cd central-auth && go test ./...`

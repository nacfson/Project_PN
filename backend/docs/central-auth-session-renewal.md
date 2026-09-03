# Central Auth Session Renewal Contract

Project PN delegates authentication to `auth.nacfson.cloud`. Session renewal is implemented in the [`central-auth/`](../../central-auth/) service (deployed as `auth-service` in the `nacfson-auth` namespace).

## Sliding cookie sessions (web)

On `GET /api/internal/cookie-session`:

1. Validate the `nacfson_session` cookie.
2. If the session is valid and `expires_at` is in the future, extend it:
   - `expires_at = min(now + SESSION_IDLE_TIMEOUT, login_at + SESSION_MAX_AGE)`
3. Persist the updated `expires_at`.
4. Return `{ user_id, email, is_admin, expires_at, auth_provider, identity }`.

`identity` shape: `{ "provider": "google" | "magic_link", "provider_subject": "<google sub or central user id>" }`.

Suggested defaults:

| Variable | Default |
|----------|---------|
| `SESSION_IDLE_TIMEOUT` | 7 days |
| `SESSION_MAX_AGE` | 30 days |

## Refresh tokens (bearer clients)

### Login redirect (native / extension)

After magic-link completion, redirect to the app with:

```
{redirectUrl}?token={access_token}&refresh_token={refresh_token}&expires_at={iso8601}
```

Hash-style redirects (`#token=...`) must include the same parameters.

### Refresh endpoint

```
POST /api/auth/refresh
Content-Type: application/json

{ "refresh_token": "..." }
```

Response `200`:

```json
{
  "token": "new-access-token",
  "refresh_token": "new-refresh-token",
  "expires_at": "2026-12-01T00:00:00Z"
}
```

- Rotate refresh tokens on each successful refresh (invalidate the previous refresh token).
- Return `401` for invalid, expired, or reused refresh tokens.

Suggested defaults:

| Token | TTL |
|-------|-----|
| Access token | 1 hour |
| Refresh token | 90 days |

### Logout

`DELETE /api/auth/session` must revoke the access session and associated refresh-token family.

## Project PN proxy

Project PN exposes `POST /api/auth/refresh` without authentication and proxies to central auth. Clients should call the Project PN API, not central auth directly.

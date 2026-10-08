# Central Auth (nacfson-auth)

Nacfson Cloud authentication service for Project PN and other apps on `*.nacfson.cloud`.

## Features

- Hosted login page (`GET /login`) — Google OAuth
- Google OAuth (`GET /auth/google`, `GET /auth/google/callback`)
- Bearer access tokens with refresh-token rotation (`POST /api/auth/refresh`)
- HttpOnly `nacfson_session` cookie sessions for hosted web apps
- Sliding cookie session expiry on `GET /api/internal/cookie-session`
- Internal cookie validation for downstream services (Project PN backend)
- Session payload includes `auth_provider` and `identity` for integrated accounts

## Local development

```sh
createdb central_auth_dev

cd central-auth
cp .env.example .env
set -a && source .env && set +a
go run ./cmd/api
```

Open the login page:

```text
http://localhost:8090/login?rd=http://localhost:8081
```

## Environment variables

| Variable | Purpose |
|----------|---------|
| `PUBLIC_BASE_URL` | Base URL for OAuth redirects |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `ADMIN_EMAILS` | Comma-separated admin emails |
| `AUTH_SESSION_INTERNAL_TOKEN` | Shared secret with downstream services |

See [`central-auth/.env.example`](.env.example).

## Project PN integration

```env
CENTRAL_AUTH_URL=http://localhost:8090
CENTRAL_AUTH_INTERNAL_URL=http://localhost:8090
AUTH_SESSION_INTERNAL_TOKEN=dev-internal-token
```

Hosted web uses the cookie flow. Native/Tauri/extension receive `token`, `refresh_token`, and `expires_at` in the redirect URL.

## Production deploy

Build and publish the image (`ghcr.io/nacfson/central-auth:<tag>`), then roll out to the `nacfson-auth` namespace (`auth-service` deployment). Configure Google OAuth and mail delivery via Cursor secrets (see `backend/docs/cursor-secrets.md`). After adding Google keys to Cursor, run `scripts/sync-auth-google-secrets.sh` from a Cloud Agent with deploy SSH access. Migration `002` revokes all sessions on deploy.

Verify: login page shows an active Google button; `/auth/google?rd=...` returns `302` to `accounts.google.com`.

Contract details: [`../backend/docs/central-auth-session-renewal.md`](../backend/docs/central-auth-session-renewal.md).

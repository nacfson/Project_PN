# Central Auth (nacfson-auth)

Nacfson Cloud authentication service for Project PN and other apps on `*.nacfson.cloud`.

## Features

- Magic-link sign-in (`POST /api/auth/magic-link`)
- Bearer access tokens with refresh-token rotation (`POST /api/auth/refresh`)
- HttpOnly `nacfson_session` cookie sessions for hosted web apps
- Sliding cookie session expiry on `GET /api/internal/cookie-session`
- Internal cookie validation for downstream services (Project PN backend)

## Local development

```sh
# Create a separate database (or reuse local Postgres on :5433)
createdb central_auth_dev

cd central-auth
cp .env.example .env
set -a && source .env && set +a
go run ./cmd/api
```

Send a magic link:

```sh
curl -sS -X POST http://localhost:8090/api/auth/magic-link \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com"}'
```

The server logs a callback URL. Open it with `rd` set to your app redirect:

```text
http://localhost:8090/auth/callback?token=...&rd=http://localhost:8081
```

For native redirects, use a custom scheme:

```text
http://localhost:8090/auth/callback?token=...&rd=projectpn://auth
```

## Project PN integration

Point Project PN at this service during local development:

```env
CENTRAL_AUTH_URL=http://localhost:8090
CENTRAL_AUTH_INTERNAL_URL=http://localhost:8090
AUTH_SESSION_INTERNAL_TOKEN=dev-internal-token
```

Hosted web uses the cookie flow. Native/Tauri/extension receive `token`, `refresh_token`, and `expires_at` in the redirect URL.

## Production deploy

Build and publish the image, then roll out to the `nacfson-auth` namespace (`auth-service` deployment). Keep `AUTH_SESSION_INTERNAL_TOKEN` aligned with the Project PN backend secret.

Contract details: [`../backend/docs/central-auth-session-renewal.md`](../backend/docs/central-auth-session-renewal.md).

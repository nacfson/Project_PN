# Quickstart Validation: Gateway JWT Auth

**Feature**: `001-gateway-jwt-auth`  
**Purpose**: Prove verification + authorization + account continuity without embedding full implementation.

## Prerequisites

- Feature branch `001-gateway-jwt-auth`
- Postgres up (`backend/compose.yaml`); `backend/.env` present
- Configured (or test doubles for):
  - `AUTH_JWT_ISSUER`
  - `AUTH_JWT_AUDIENCE` (project client id)
  - `AUTH_JWT_JWKS_URL` (cluster or test JWKS)
  - Allowed algs (e.g. RS256)
- Operator migration procedure available for at least one sample existing user ([operator-migration.md](./contracts/operator-migration.md))
- Platform/docs for obtaining a **Google**-brokered project access JWT (Apple/Email out of scope)

## 1. Automated verification matrix

From repo root after implementation:

```sh
cd backend && set -a && source .env && set +a
GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/auth/ ./internal/http/ -count=1
```

Expect coverage of [jwt-verification.md](./contracts/jwt-verification.md) accept/reject cases and ordinary/admin/cross-user denies from the spec.

## 2. Local API smoke (valid vs invalid)

1. Start API: `cd backend && set -a && source .env && set +a && go run ./cmd/api`
2. `GET /healthz` → 200 without token  
3. `GET /api/auth/me` without `Authorization` → 401/403  
4. `GET /api/auth/me` with forged `X-User-Subject` only → 401/403  
5. `GET /api/auth/me` with valid project access JWT → 200 ordinary profile  
6. Token with wrong `aud` / expired / bad sig → reject  

## 3. Operator migration continuity

1. Note an existing local user with learning data (`user_word_senses` count > 0).  
2. Run operator bind of Keycloak `(issuer, subject)` → that `users.id` with `sign_in_method=google`.  
3. Call API with JWT for that subject → same user id; learning list non-empty.  
4. Confirm account table was not wiped.

## 4. Hard cutover check

- Present legacy central-auth / `mock-dev-token` style credential with production config → reject.  
- Dev bypass only when explicitly enabled for non-prod.

## 5. Hosted smoke (when environment available)

Align with platform AC-01 / AC-03 / AC-04 / AC-05 / AC-12:

1. First Google sign-in via gateway → ordinary landing, no admin.  
2. Unauthenticated browser hit to protected host → not authenticated app content.  
3. After gateway logout/revoke → next project request fails.  
4. Ordinary cannot read another user’s private data.

Record pass/fail + commands in operator notes; **do not** commit live tokens.

## 6. Frontend / multi-client note

Web and non-web clients must send the same Bearer project JWT. Platform owns acquisition; PN only verifies. Google-only live IdP this delivery.

## Related artifacts

- [spec.md](./spec.md)  
- [data-model.md](./data-model.md)  
- [plan.md](./plan.md)  
- [research.md](./research.md)  

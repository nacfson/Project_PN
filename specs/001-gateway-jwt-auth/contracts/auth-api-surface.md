# Contract: Project PN Auth HTTP Surface (post-cutover)

## Protected API auth

All `/api/*` routes that today require Bearer/central session continue to require a **verified project access JWT**, except explicitly public health probes.

| Method | Path | Behavior after cutover |
|--------|------|-------------------------|
| `GET` | `/api/auth/me` | Requires valid JWT; returns local user + linked identity metadata (issuer/subject method), not central-auth session blob |
| `GET` | `/api/auth/linked-providers` | Lists local identity bindings (sign-in methods) for current user |
| `POST` | `/api/auth/logout` | Prefer platform/gateway logout; if retained, must not call central-auth session delete — document platform logout URL for clients |
| `POST` | `/api/auth/refresh` | **Deprecate** central-auth refresh proxy; clients refresh via platform/Keycloak. May return 410 Gone or be removed |

Merge-request endpoints (if retained) continue to authorize the authenticated local user only.

## Public

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/healthz` | Unauthenticated; no user data |
| `GET` | `/readyz` | Unauthenticated DB ping; no user data |

## Client credential

```http
Authorization: Bearer <keycloak_project_access_jwt>
```

No production acceptance of `mock-dev-token` or central-auth cookie as proof of identity.

## Errors

| Condition | Status |
|-----------|--------|
| Missing/invalid JWT | 401 (or 403 per existing API conventions) |
| Valid JWT, ordinary hitting admin/undeclared | 403 |
| Valid JWT, cross-user private data | 403 |

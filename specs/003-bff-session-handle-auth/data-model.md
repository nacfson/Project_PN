# Phase 1 Data Model: 4-Layer Cookie-Free BFF & Sealed Session Handle Authentication

**Feature**: `003-bff-session-handle-auth`  
**Date**: 2026-10-15

---

## 1. Database Schema Impact

**None (Zero PostgreSQL migrations required).**

Per Project PN Constitution Principle III (Lean MVP Schema), durable user identity bindings remain stored in the existing `users` and `user_identities` tables keyed by `(issuer, subject)` with `sign_in_method = 'google'`. All BFF handshake artifacts (CSRF nonces, gateway tickets, and 30-second pickup codes) are ephemeral protocol state.

---

## 2. Ephemeral In-Memory & Protocol Entities

### 2.1 `LoginCSRFNonce` (Cookie + URL Binding)

| Field | Type | Constraints / Format | Lifecycle |
| :--- | :--- | :--- | :--- |
| `Nonce` | `string` | 32 lowercase hex chars (16 random bytes); stored in `__Host-pa_nonce` cookie (`Path=/`, `MaxAge=600`, `HttpOnly`, `Secure`, `SameSite=Lax`) | Created on `GET /api/auth/login`; cleared (`MaxAge=-1`) on `GET /api/auth/callback` |
| `BindDigest` | `string` | `base64.RawURLEncoding(sha256(Nonce))`; passed in callback URL query `?pa_bind=...` | Verified via `subtle.ConstantTimeCompare` on `GET /api/auth/callback` |

### 2.2 `ExchangeResponse` (`backend/internal/auth/gateway_client.go`)

Returned by internal `POST http://gateway.identity.svc:8080/auth/exchange`:

| Field | JSON Key | Type | Validation Rules |
| :--- | :--- | :--- | :--- |
| `SessionHandle` | `session_handle` | `string` | Non-empty, prefixed with `"v1."` |
| `Subject` | `subject` | `string` | Non-empty Keycloak user `sub` UUID |
| `Issuer` | `issuer` | `string` | Non-empty realm issuer URL (`https://auth.nacfson.cloud/realms/platform`) |
| `Audience` | `audience` | `string` | Must equal `"project-pn"` |
| `ExpiresIn` | `expires_in` | `int64` | Session TTL in seconds (e.g., `28800` for 8h; defaults to `28800` if `<= 0`) |

### 2.3 `pickupEntry` (`backend/internal/http/auth_handler.go`)

Stored in `authHandler.pickupCodes map[string]pickupEntry` under `sync.Mutex`:

| Field | Type | Constraints | Lifecycle |
| :--- | :--- | :--- | :--- |
| `Code` (map key) | `string` | 32 lowercase hex chars (16 random bytes) | Generated on `GET /api/auth/callback` |
| `SessionHandle` | `string` | `v1.<session_handle>` from gateway ticket exchange | Returned as `token` and `refresh_token` on `POST /api/auth/session` |
| `SessionExpiresAt` | `time.Time` | `now.Add(time.Duration(exch.ExpiresIn) * time.Second)` | Returned as `expires_at` on `POST /api/auth/session` |
| `ExpiresAt` | `time.Time` | `now.Add(30 * time.Second)` | Single-use; deleted immediately on first lookup or evicted when `now.After(ExpiresAt)` |

### 2.4 `SessionResponse` (`POST /api/auth/session` DTO)

Compatible with `@project-pn/api` `SessionResponse`:

| Field | JSON Key | Type | Description |
| :--- | :--- | :--- | :--- |
| `Token` | `token` | `string` | `v1.<session_handle>` used as `Authorization: Bearer v1.<session_handle>` |
| `RefreshToken` | `refresh_token` | `string` | `v1.<session_handle>` |
| `ExpiresAt` | `expires_at` | `time.Time` (RFC3339) | Session expiration timestamp |

---

## 3. State Transitions

```text
[Unauthenticated Browser]
   │ GET /api/auth/login
   ▼
[Nonce Bound (__Host-pa_nonce set, 10m TTL)]
   │ 302 -> Platform /oauth/start -> Google OIDC -> /api/auth/callback?pa_bind=...&ticket=v1....
   ▼
[Callback Verified & Ticket Exchanged]
   ├── (Nonce mismatch) ──────────────► 400 Bad Request
   ├── (Ticket invalid / wrong aud) ──► Clear nonce, 302 -> ${PUBLIC_APP_URL}/
   └── (Valid ticket + EnsurePlatformUser)
         │ Clear nonce, store 30s single-use pickup code
         │ 302 -> ${PUBLIC_APP_URL}/?code=<32-hex>
         ▼
[Frontend Pickup Exchange]
   │ Scrub ?code= via history.replaceState
   │ POST /api/auth/session {"code": "<32-hex>"}
   ├── (Body > 4KB or len(code) != 32) ► 400 Bad Request
   ├── (Missing / expired / replayed) ─► 401 Unauthorized
   └── (Valid single-use code) ────────► 200 OK { token: "v1....", refresh_token: "v1....", expires_at }
         │
         ▼
[Authenticated Session (Bearer v1.<session_handle>)]
   ├── Protected API request ─────────► Gateway GET /auth + JWKS JWTVerifier
   │                                    (Optional X-Refreshed-Session-Handle header)
   └── POST /api/auth/logout ─────────► Gateway POST /auth/logout -> 204 No Content
```

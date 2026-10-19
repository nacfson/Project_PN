# Phase 0 Research: 4-Layer Cookie-Free BFF & Sealed Session Handle Authentication

**Feature**: `003-bff-session-handle-auth`  
**Date**: 2026-10-15  
**Input**: `specs/003-bff-session-handle-auth/spec.md`, `docs/handoff-spec009-bff-auth.md`

---

## 1. Login CSRF Protection via Host-Only Nonce Binding (`CWE-352`)

- **Decision**: Use a 16-byte cryptographically random nonce encoded as 32 hex characters stored in a host-only cookie `__Host-pa_nonce` (`Path=/`, `MaxAge=600`, `HttpOnly=true`, `Secure=true`, `SameSite=Lax`) on `GET /api/auth/login`, and bind the callback `return` URL with `pa_bind = base64.RawURLEncoding.EncodeToString(sha256(nonce))`. Verify on `GET /api/auth/callback` using `subtle.ConstantTimeCompare` before calling the platform gateway.
- **Rationale**:
  - The `__Host-` prefix forces browsers to scope the cookie strictly to the Project PN host (`pn.nacfson.cloud`) over HTTPS with `Path=/` and no `Domain` attribute, preventing sibling subdomains from planting or overwriting the nonce.
  - Hashing the nonce with SHA-256 in the `pa_bind` query parameter ensures the raw cookie value is never exposed in redirect URLs or third-party logs while cryptographically binding the browser that started `/api/auth/login` to the browser completing `/api/auth/callback`.
  - Constant-time comparison (`crypto/subtle.ConstantTimeCompare`) eliminates timing side-channels.
- **Alternatives Considered**:
  - *Cross-subdomain `PLATFORM_SESSION` cookie*: Retired by `nacfson_pipeline` Spec 009 due to cross-subdomain cookie scoping and browser third-party/subdomain restrictions.
  - *Stateless unverified redirect*: Vulnerable to Login CSRF (`CWE-352`), allowing an attacker to force a victim browser into an attacker-controlled session.

---

## 2. Single-Use 30-Second Pickup Code Exchange (`CWE-384` & `CWE-770`)

- **Decision**: Store a 32-character hex pickup code in an in-memory `sync.Mutex`-guarded map with a 30-second TTL upon successful `/api/auth/callback`. The frontend immediately removes `?code=` via `window.history.replaceState` and exchanges it via `POST /api/auth/session` with a 4 KB `http.MaxBytesReader` body cap.
- **Rationale**:
  - Delivering `v1.<session_handle>` directly in a query parameter (`?token=v1...`) risks leaking the long-lived handle into browser history, Referer headers, and proxy logs.
  - A 30-second single-use hex pickup code redeemed via `POST /api/auth/session` ensures the credential is transmitted only in a JSON response body and that replaying the URL after reload fails closed (`401 Unauthorized`).
  - `http.MaxBytesReader(w, r.Body, 4<<10)` protects the unauthenticated `POST /api/auth/session` endpoint from memory exhaustion (`CWE-770`).
  - Sweeping expired entries under the mutex during write and lookup prevents unbounded map growth without requiring background goroutines.
- **Alternatives Considered**:
  - *Database-backed pickup table*: Violates Constitution Principle III (Lean MVP Schema) which forbids adding non-MVP tables when an ephemeral 30-second in-memory store satisfies single-replica k3s requirements.
  - *Passing `v1.<session_handle>` in URL fragment*: Less uniform across web/SSR/proxy layers and specified against by the Spec 009 platform handoff.

---

## 3. Dual-Stage `Bearer v1.<session_handle>` Verification & Handle Preservation

- **Decision**: When `authMiddleware` receives `Authorization: Bearer v1.<session_handle>`:
  1. Call `gateway.ConfirmSessionHandle(ctx, host, token)` (`GET http://gateway.identity.svc:8080/auth` with `Authorization: Bearer v1.<session_handle>` and `X-Forwarded-Host`).
  2. Propagate `X-Refreshed-Session-Handle` to the response header if returned by the gateway.
  3. Verify the underlying Keycloak access JWT (`ident.Token`) using Project PN's existing `JWTVerifier` (signature via cluster JWKS, `iss`, `aud = project-pn`, `exp`, `sub`).
  4. Store the original `v1.<session_handle>` in `authSession.credential` inside `r.Context()` so `POST /api/auth/logout` can revoke `v1.<session_handle>` at `POST http://gateway.identity.svc:8080/auth/logout`.
- **Rationale**:
  - Preserves defense-in-depth (Constitution Technical Constraints & Security Standards): Project PN never trusts gateway headers alone and still cryptographically verifies the underlying Keycloak access JWT via JWKS.
  - Preserving the original `v1.` handle in `authSession` ensures `POST /api/auth/logout` sends the sealed handle expected by the gateway's `/auth/logout` endpoint rather than the ephemeral unwrapped JWT.
- **Alternatives Considered**:
  - *Skipping `JWTVerifier` after gateway confirmation*: Rejected; violates Constitution Principle III / Security Standards requiring independent JWT verification.
  - *Overwriting `authSession.credential` with the unwrapped JWT*: Rejected; breaks `POST /api/auth/logout` because the gateway revokes `v1.<session_handle>`.

---

## 4. Public Auth Origin & Host Resolution

- **Decision**:
  - Derive the public auth origin for `GET /api/auth/login` redirects from `PUBLIC_AUTH_ORIGIN` (if set), else scheme+host of `CENTRAL_AUTH_URL`, else scheme+host of `AUTH_JWT_ISSUER` (defaulting to `https://auth.nacfson.cloud`).
  - When forwarding `X-Forwarded-Host` to the internal gateway, prefer the inbound `X-Forwarded-Host` or `r.Host`; if the host is a local/test placeholder (`localhost`, `127.0.0.1`, `example.com`, or empty), normalize to `pn.nacfson.cloud` so `DeriveProjectAudience` resolves `project-pn` consistently across local dev, `httptest`, and production.
- **Rationale**:
  - Production `pn-backend` pods no longer require legacy `CENTRAL_AUTH_URL` once cut over to `AUTH_JWT_ISSUER=https://auth.nacfson.cloud/realms/platform`, so deriving scheme+host from `CENTRAL_AUTH_URL` with fallback to `AUTH_JWT_ISSUER` works seamlessly in both transitional and post-cutover environments.

---

## 5. Secret-Scanner Safe Test JWT Construction (`Gitleaks`)

- **Decision**: Construct all synthetic JWTs in Go and TypeScript tests at runtime using `base64.RawURLEncoding.EncodeToString` / `jwx` signing helpers rather than hardcoded `eyJ...` literals.
- **Rationale**: Static base64-encoded JSON headers (`eyJhbGci...`) trigger `Gitleaks` and `cursor[bot]` security audit failures in CI. Runtime encoding is deterministic and audit-clean.

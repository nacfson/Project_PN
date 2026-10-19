# Interface Contracts: BFF Auth & Internal Gateway (`003-bff-session-handle-auth`)

**Feature**: `003-bff-session-handle-auth`  
**Date**: 2026-10-15  
**Normative Reference**: `docs/handoff-spec009-bff-auth.md`

---

## 1. Public Project PN Backend BFF Endpoints

### 1.1 `GET /api/auth/login`

Initiates the browser BFF login flow. Unauthenticated route.

- **Query Parameters**:
  - `next` *(optional)*: Relative path (must start with `/` and not `//`) to append to the callback URL if provided.
- **Response (`302 Found`)**:
  - `Set-Cookie`: `__Host-pa_nonce=<32-char-hex>; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`
  - `Location`: `${PUBLIC_AUTH_ORIGIN}/oauth/start?return=${url.QueryEscape(callbackURL)}`
    - Where `callbackURL` is `${PUBLIC_APP_URL}/api/auth/callback?pa_bind=<base64url(sha256(nonce))>`

---

### 1.2 `GET /api/auth/callback`

Completes the OIDC redirect from the platform gateway, exchanges the single-use gateway ticket, provisions/loads the learner, and redirects to the frontend with a short-lived pickup code. Unauthenticated route.

- **Query Parameters**:
  - `pa_bind` *(required)*: Base64url-encoded SHA-256 digest of the `__Host-pa_nonce` cookie value.
  - `ticket` *(required)*: Single-use platform ticket (`v1.<ticket>`).
- **Cookies Required**:
  - `__Host-pa_nonce`: Must exist and match `pa_bind` via `subtle.ConstantTimeCompare`.
- **Responses**:
  - **`400 Bad Request`**: Missing `__Host-pa_nonce` cookie, missing `pa_bind`, or digest mismatch (Login CSRF blocked; no gateway call made).
  - **`302 Found` to `${PUBLIC_APP_URL}/`** *(on missing/expired/invalid ticket or `audience != "project-pn"`)*:
    - Clears `__Host-pa_nonce` (`Max-Age=-1`).
  - **`302 Found` to `${PUBLIC_APP_URL}/?code=<32-char-hex>`** *(on success)*:
    - Clears `__Host-pa_nonce` (`Max-Age=-1`).
    - Ensures local user exists via `EnsurePlatformUser(ctx, issuer, subject, email, "google")`.
    - Stores `<32-char-hex>` pickup code in memory with a 30-second TTL.

---

### 1.3 `POST /api/auth/session`

Exchanges the 30-second single-use pickup code for the sealed `v1.<session_handle>`. Unauthenticated route.

- **Request Constraints**:
  - Body size capped at `4096` bytes via `http.MaxBytesReader(w, r.Body, 4<<10)` (`CWE-770`).
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "code": "0123456789abcdef0123456789abcdef"
  }
  ```
- **Responses**:
  - **`200 OK`**:
    ```json
    {
      "token": "v1.<session_handle>",
      "refresh_token": "v1.<session_handle>",
      "expires_at": "2026-10-15T20:30:00Z"
    }
    ```
  - **`400 Bad Request`**: Malformed JSON, body exceeds 4,096 bytes, or `len(strings.TrimSpace(code)) != 32`.
  - **`401 Unauthorized`**: Pickup code unknown, already consumed, or expired (> 30s).

---

### 1.4 Protected API Requests (`Authorization: Bearer v1.<session_handle>`)

All protected `/api/*` endpoints accept `Authorization: Bearer v1.<session_handle>` in addition to direct project access JWTs.

- **Inbound Header**:
  - `Authorization: Bearer v1.<session_handle>`
- **Outbound Header (when rotated by gateway)**:
  - `X-Refreshed-Session-Handle: v1.<rotated_session_handle>`
- **Failure Response**:
  - `401 Unauthorized` (`{"error":"unauthorized","code":"AUTH-101","retryable":false}`)

---

### 1.5 `POST /api/auth/logout`

Revokes the caller's session. Protected route (`authMiddleware` + `csrfProtection`).

- **Inbound Header**:
  - `Authorization: Bearer v1.<session_handle>`
- **Behavior**:
  - When the session credential starts with `"v1."`, calls internal gateway `POST /auth/logout` with `Authorization: Bearer v1.<session_handle>` (sends only the login; never sends a Keycloak client id, client secret, or session id).
- **Responses**:
  - `200 OK` (`{"status":"revoked"}`): Session handle revoked at gateway (only when gateway returns `200 OK` with `status == "revoked"` after Keycloak `DELETE /admin/realms/platform/sessions/{sessionId}` returned `204` or `200`).
  - `502 Bad Gateway` (`{"error":"revocation_failed","message":"..."}`): Forwarded when the gateway reports Keycloak refused the session delete or did not confirm `status: "revoked"`. Never claims `status: "revoked"`.
  - `503 Service Unavailable` (`{"error":"service_unavailable","message":"..."}`): Forwarded when the gateway reports Keycloak unreachable or when the internal gateway is unreachable. Never claims `status: "revoked"`.
  - `401 Unauthorized`: Missing or invalid session credential before revocation.

---

## 2. Cluster-Internal Platform Gateway Contract (`http://gateway.identity.svc:8080`)

| Endpoint | Method | Request Headers & Body | Expected Response |
| :--- | :--- | :--- | :--- |
| `/auth/exchange` | `POST` | `X-Forwarded-Host: pn.nacfson.cloud`<br>`Content-Type: application/json`<br>`{"ticket": "v1...."}` | `200 OK`: `{"session_handle": "v1....", "subject": "<uuid>", "issuer": "https://auth.nacfson.cloud/realms/platform", "audience": "project-pn", "expires_in": 28800}` |
| `/auth` | `GET` | `Authorization: Bearer v1.<session_handle>`<br>`X-Forwarded-Host: pn.nacfson.cloud` | `200 OK` Headers:<br>`Authorization: Bearer <verified-keycloak-access-jwt>`<br>`X-User-Subject: <uuid>`<br>`X-User-Issuer: https://auth.nacfson.cloud/realms/platform`<br>`X-Project-Audience: project-pn`<br>`X-Refreshed-Session-Handle: v1.<rotated>` *(optional)* |
| `/auth/logout` | `POST` | `Authorization: Bearer v1.<session_handle>` | `200 OK` (`{"status": "revoked"}`) only when Keycloak `DELETE /admin/realms/platform/sessions/{sessionId}` returned `204` or `200`; `502 Bad Gateway` when Keycloak refuses delete; `503 Service Unavailable` when Keycloak is unreachable |

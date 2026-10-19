# Feature Specification: 4-Layer Cookie-Free BFF & Sealed Session Handle Authentication

**Feature Branch**: `003-bff-session-handle-auth`

**Created**: 2026-10-15

**Status**: Ready for Planning

**Input**: Handoff specification `docs/handoff-spec009-bff-auth.md` (Spec 009): Replace cross-subdomain browser session cookies with a 4-layer cookie-free Backend-For-Frontend (BFF) and internal platform gateway sealed session handle (`v1.<session_handle>`) architecture.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browser Learner Completes Cookie-Free BFF Sign-In (Priority: P1)

A learner using the web application clicks "Sign In". Instead of relying on cross-subdomain session cookies, the application initiates sign-in through the Project PN backend, which binds the browser to a short-lived anti-CSRF nonce and delegates authentication to the platform identity service (Google sign-in). Upon returning from the identity provider, the backend verifies the anti-CSRF binding, exchanges the platform's single-use ticket for a sealed session handle, provisions or loads the learner's profile, and redirects the learner back to the web app with a short-lived, single-use pickup code. The web app immediately removes the pickup code from the address bar, exchanges it for the sealed session handle, and transitions the learner into their study workspace.

**Why this priority**: Browser sign-in is the primary entry point for web learners. Without the 4-layer BFF login, callback, and pickup-code exchange flow, browser users cannot sign in once cross-subdomain session cookies are retired.

**Independent Test**: Initiate web sign-in, complete the callback with a valid nonce binding and platform ticket, exchange the resulting pickup code for a session, and confirm the browser removes the code from the URL and enters the authenticated study state.

**Acceptance Scenarios**:

1. **Given** an unauthenticated learner on the web sign-in screen, **When** they trigger sign-in, **Then** the browser navigates to the Project PN backend login endpoint, receives a host-only anti-CSRF binding cookie (10-minute lifetime), and is redirected to the platform identity start endpoint with a return callback URL containing the cryptographic digest of the nonce.
2. **Given** a learner returning to the backend callback endpoint with a valid platform ticket and a matching anti-CSRF nonce cookie, **When** the backend processes the callback, **Then** it clears the nonce cookie, exchanges the ticket with the internal platform gateway for a project-scoped sealed session handle, ensures the learner's local account exists, and redirects the browser to the web application root with a 32-character hexadecimal pickup code valid for 30 seconds.
3. **Given** the web application launches with a `?code=` query parameter in the browser URL, **When** startup authentication runs, **Then** the application immediately strips the `code` parameter from the browser history/URL bar, exchanges the code at the backend session endpoint, stores the returned sealed session credential, and renders the authenticated learner experience.

---

### User Story 2 - Authenticated API Requests & Seamless Session Rotation via Sealed Session Handles (Priority: P1)

Once signed in, the learner studies vocabulary, adds words, and reviews flashcards. Every protected request from the client presents the sealed session handle (`v1.<session_handle>`) as a Bearer credential. The Project PN backend confirms the sealed session handle with the internal platform gateway, independently verifies the underlying project-scoped access credential (`project-pn` audience, issuer, signature, and expiry), and authorizes the request for the learner's account. If the platform gateway rotates the session handle during confirmation, the backend forwards the refreshed handle header so the session remains active without interrupting the learner.

**Why this priority**: Protected learning actions require continuous, defense-in-depth verification of the sealed session handle on every request while preserving existing JWT verification guarantees.

**Independent Test**: Send protected API requests with a valid `Bearer v1.<session_handle>` credential; confirm the backend validates the handle via the platform gateway, verifies the underlying project access token, executes the request for the resolved learner, and propagates any rotated session handle header.

**Acceptance Scenarios**:

1. **Given** an authenticated learner presenting a valid `Bearer v1.<session_handle>` credential on a protected endpoint, **When** the backend processes the request, **Then** it confirms the handle with the internal platform gateway, verifies the returned project access credential against cluster trust material, and processes the request under the learner's local account.
2. **Given** the internal platform gateway returns a rotated session handle during confirmation, **When** the backend responds to the client, **Then** the response includes the refreshed session handle in the `X-Refreshed-Session-Handle` header.
3. **Given** a client presenting an expired, revoked, malformed, or wrong-audience `v1.<session_handle>` credential, **When** the backend processes the request, **Then** the backend rejects the request with `401 Unauthorized` (`AUTH-101`) without executing business logic.

---

### User Story 3 - Attack Prevention: Login CSRF, Replay, and Payload Abuse Protection (Priority: P1)

An attacker attempts to force a victim's browser into an attacker-controlled account (Login CSRF), replay a captured callback ticket or pickup code, or exhaust backend memory by sending oversized payloads to the session exchange endpoint. The system blocks each attack vector fail-closed.

**Why this priority**: Authentication endpoints are public-facing surfaces; strict CSRF binding, single-use token lifetimes, and request size bounds are mandatory security invariants.

**Independent Test**: Submit callback requests with missing or mismatched nonce cookies, replay a pickup code a second time or after 30 seconds, and send an oversized request body (> 4 KB) to the session exchange endpoint; verify all are rejected with appropriate `400` or `401` responses.

**Acceptance Scenarios**:

1. **Given** a request to the backend callback endpoint where the host-only nonce cookie is missing or its digest does not match the callback binding parameter in constant-time comparison, **When** the callback is evaluated, **Then** the backend immediately rejects the request with `400 Bad Request` and does not contact the platform gateway.
2. **Given** a callback request with an expired, invalid, or already-used platform ticket, **When** the internal gateway exchange fails, **Then** the backend clears the nonce cookie and redirects (`302 Found`) the browser cleanly back to the application root without issuing a pickup code.
3. **Given** a 32-character pickup code that has already been exchanged once (or has exceeded its 30-second lifetime), **When** any client submits that code to the session exchange endpoint, **Then** the backend rejects the request with `401 Unauthorized` and ensures expired codes are evicted.
4. **Given** a request to the session exchange endpoint with a body larger than 4,096 bytes or a pickup code that is not a 32-character string, **When** the backend reads the request, **Then** it enforces a 4 KB read limit and returns `400 Bad Request`.

---

### User Story 4 - Explicit Session Revocation on Logout (Priority: P2)

When an authenticated learner signs out of Project PN while using a sealed session handle, the backend preserves the original `v1.<session_handle>` credential in the request session context and instructs the internal platform gateway to revoke that handle so it cannot be reused.

**Why this priority**: Learners must be able to terminate their active session cleanly on shared or personal devices, ensuring the sealed handle is invalidated at the platform gateway.

**Independent Test**: Call the logout endpoint with an active `Bearer v1.<session_handle>` credential and verify that the backend invokes the platform gateway logout endpoint with the sealed session handle and returns a successful logout status.

**Acceptance Scenarios**:

1. **Given** an authenticated learner whose session was established with `Bearer v1.<session_handle>`, **When** they invoke the logout endpoint, **Then** the backend forwards only `Authorization: Bearer v1.<session_handle>` to the internal platform gateway revocation endpoint (`POST /auth/logout`) and completes logout with `200 OK` `{"status":"revoked"}` only when the gateway returns `200 OK` with `status == "revoked"`.
2. **Given** the platform gateway returns `502 Bad Gateway` (Keycloak refused delete or revocation was unconfirmed) or `503 Service Unavailable` (Keycloak or gateway unreachable), **When** the backend processes the logout request, **Then** it logs the failure, forwards `502` or `503` without claiming `status: "revoked"`, and leaves the bearer `session_handle` usable for a subsequent logout retry.

---

### Edge Cases

- **Missing or tampered `__Host-pa_nonce` cookie on callback**: Reject with `400 Bad Request` via constant-time digest comparison before any gateway network call.
- **Expired or replayed gateway ticket on callback**: Clear the `__Host-pa_nonce` cookie and redirect (`302 Found`) to the public application root (`/`) rather than stranding the user on an error JSON page.
- **Mismatched audience from gateway ticket exchange (`audience != "project-pn"`)**: Treat as failed exchange and do not issue a pickup code.
- **Browser page reload after `?code=` redirect**: Because the frontend scrubs `?code=` from the URL via `history.replaceState` before/during exchange, reloading the page does not re-trigger a failed exchange; if a used code is ever re-sent, the backend returns `401 Unauthorized`.
- **Pickup code memory accumulation**: Expired pickup codes (older than 30 seconds) are automatically evicted during lookup/insertion under concurrency protection so memory stays bounded.
- **Oversized JSON payload on `POST /api/auth/session`**: Capped at 4,096 bytes (`4<<10`) before decoding to prevent memory exhaustion (`CWE-770`).
- **Gateway unreachable during `v1.` session confirmation**: Fail closed with `401 Unauthorized` (`AUTH-101`).
- **Automated test secret scanning**: Test suites constructing synthetic JWT payloads for gateway confirmation tests must encode segments dynamically at runtime rather than embedding static base64 JWT literals.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The backend MUST expose an unauthenticated login initiation endpoint (`GET /api/auth/login`) that generates a 16-byte cryptographic random nonce (32 hex characters), sets a host-only `__Host-pa_nonce` cookie (`Path=/`, `MaxAge=600`, `HttpOnly`, `Secure`, `SameSite=Lax`), and redirects (`302 Found`) the browser to the platform's `/oauth/start` endpoint with a `return` callback URL containing `pa_bind=<base64url(sha256(nonce))>` (and an optional sanitized `next` path).
- **FR-002**: The backend MUST expose an unauthenticated callback endpoint (`GET /api/auth/callback`) that validates the presence of the `__Host-pa_nonce` cookie and verifies in constant time that its SHA-256 base64url digest matches the `pa_bind` query parameter, returning `400 Bad Request` on any mismatch or absence (`CWE-352`).
- **FR-003**: Upon valid nonce verification at `GET /api/auth/callback`, the backend MUST clear the `__Host-pa_nonce` cookie (`MaxAge: -1`) and exchange the `ticket` query parameter with the internal platform gateway (`POST /auth/exchange`) including the `X-Forwarded-Host` header.
- **FR-004**: If the internal gateway ticket exchange fails, is expired/replayed, or returns an audience other than `project-pn`, `GET /api/auth/callback` MUST redirect (`302 Found`) the browser to the public application root without issuing a pickup code.
- **FR-005**: After a valid ticket exchange at `GET /api/auth/callback`, the backend MUST confirm the resulting session handle against the internal gateway (or verify the returned Keycloak access token) to extract identity claims, provision or load the learner account via `(issuer, subject)` binding (`EnsurePlatformUser` with `google` sign-in method), store a 32-character hex single-use pickup code with a 30-second TTL in memory, and redirect (`302 Found`) the browser to `${PUBLIC_APP_URL}/?code=<pickup_code>`.
- **FR-006**: The backend MUST expose an unauthenticated session pickup endpoint (`POST /api/auth/session`) that limits the request body to 4,096 bytes (`CWE-770`), validates that `code` is a 32-character string (`400 Bad Request` otherwise), atomically looks up and deletes the pickup code while evicting expired entries (`CWE-384`), returns `401 Unauthorized` if the code is missing or expired, and returns `200 OK` with `{ token, refresh_token, expires_at }` containing the `v1.<session_handle>` when valid.
- **FR-007**: When a protected request presents `Authorization: Bearer v1.<session_handle>`, the backend authentication middleware MUST confirm the handle with the internal platform gateway (`GET /auth` with `Authorization: Bearer v1.<session_handle>` and `X-Forwarded-Host`), verify the returned project access credential through the project's JWT verifier, and fail closed with `401 Unauthorized` (`AUTH-101`) if confirmation or verification fails.
- **FR-008**: When the internal platform gateway includes `X-Refreshed-Session-Handle` on a successful session handle confirmation, the backend authentication middleware MUST copy `X-Refreshed-Session-Handle` to the HTTP response headers.
- **FR-009**: The backend authentication middleware MUST preserve the original `v1.<session_handle>` credential in the request's auth session context while passing the underlying verified access token to downstream claim verification, so that `POST /api/auth/logout` forwards `Authorization: Bearer v1.<session_handle>` to the internal platform gateway (`POST /auth/logout`), returns `200 OK` `{"status":"revoked"}` only when the gateway confirms `status == "revoked"`, and forwards `502 Bad Gateway` or `503 Service Unavailable` unchanged without claiming `status: "revoked"`.
- **FR-010**: On browser web, the frontend sign-in action MUST initiate authentication by navigating to `${API_BASE_URL}/api/auth/login` instead of redirecting directly to the platform auth host from client code.
- **FR-011**: On browser web startup, when a `code` query parameter is present in `window.location.search`, the frontend launch utility MUST immediately remove `code` from the browser URL via `window.history.replaceState` and exchange it via `POST ${API_BASE_URL}/api/auth/session` to establish the client session.
- **FR-012**: All new and updated unit and integration tests MUST construct any test JWT payloads dynamically at runtime rather than committing hardcoded `eyJ...` base64 JWT string literals.

### Key Entities

- **Login CSRF Nonce (`__Host-pa_nonce` / `pa_bind`)**: A 16-byte cryptographic random value stored in a host-only, secure, HTTP-only cookie for up to 10 minutes and paired with its SHA-256 base64url digest in the callback URL to guarantee that the browser completing callback is the same browser that initiated login.
- **Platform Ticket (`v1.<ticket>`)**: A 60-second single-use credential issued by the platform gateway on `/oauth/callback` and exchanged server-to-server by the Project PN backend for a sealed session handle.
- **Sealed Session Handle (`v1.<session_handle>`)**: An opaque, platform-sealed credential representing the user's authenticated session for the `project-pn` audience, presented by the client as `Authorization: Bearer v1.<session_handle>` and confirmed/rotated via the internal platform gateway.
- **Single-Use Pickup Code (`code`)**: A 32-character hexadecimal token with a 30-second lifetime stored in Project PN backend memory that allows the browser frontend to retrieve its `v1.<session_handle>` via a `POST` request without exposing long-lived credentials in browser URL history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid browser sign-in flows complete the 4-layer sequence (`/api/auth/login` -> platform `/oauth/start` -> `/api/auth/callback` -> frontend `?code=` pickup via `POST /api/auth/session`) and yield an authenticated learner session without relying on cross-subdomain browser cookies.
- **SC-002**: 100% of callback attempts with missing, tampered, or mismatched anti-CSRF nonce bindings are rejected with `400 Bad Request` before any gateway ticket exchange call occurs.
- **SC-003**: 100% of pickup code reuse attempts, expired pickup code submissions (> 30 seconds), and malformed/oversized (> 4 KB) session exchange payloads are rejected in automated tests.
- **SC-004**: 100% of protected API requests carrying a valid `Bearer v1.<session_handle>` authorize as the expected `(issuer, subject)` learner, propagate `X-Refreshed-Session-Handle` when rotated, and revoke the handle at the gateway upon logout.
- **SC-005**: All backend, frontend, and security audit checks (including static analysis, serial Go test suite, frontend test suite, Add-tab Manual-first invariant, and secret scanning) pass with zero regressions or blocking findings.

## Assumptions

- The platform internal gateway (`http://gateway.identity.svc:8080`) already implements `/oauth/start`, `POST /auth/exchange`, `GET /auth`, and `POST /auth/logout` per `nacfson_pipeline` Spec 009 (PR #40).
- `PUBLIC_APP_URL` (e.g., `https://pn.nacfson.cloud`) and the public auth origin (derived from `CENTRAL_AUTH_URL` or configured auth host, e.g., `https://auth.nacfson.cloud`) are available in backend configuration, with sensible local development defaults.
- Project PN runs as a single backend replica in the target k3s deployment (or sticky/short-lived callback), making an in-memory mutex-protected map with TTL eviction appropriate for the 30-second single-use pickup code store as specified in the Spec 009 handoff.
- Existing learner account resolution (`EnsurePlatformUser` keyed by `(issuer, subject)`), JWKS verification of the underlying Keycloak access JWT, and `AUTH_DEV_BYPASS` for local development remain unchanged.

# Tasks: 4-Layer Cookie-Free BFF & Sealed Session Handle Authentication

**Input**: Design documents from `/specs/003-bff-session-handle-auth/`

**Prerequisites**: [plan.md](plan.md) (required), [spec.md](spec.md) (required for user stories), [research.md](research.md), [data-model.md](data-model.md), [contracts/bff-auth-api.md](contracts/bff-auth-api.md)

**Tests**: Automated unit and integration tests are REQUIRED per `FR-012` and `SC-001`–`SC-005` in `spec.md`.

**Organization**: Tasks are grouped by user story (`US1`–`US4`) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Exact file paths and verbatim data-model/security constraints are included in each task description

---

## Phase 1: Setup (Shared Configuration & Router Dependencies)

**Purpose**: Plumb public application URL and public auth origin configuration into the HTTP router dependencies so BFF handlers can construct redirect and callback URLs.

- [X] T001 Add `PublicAppURL` and `PublicAuthOrigin` fields to `httpapi.Dependencies` in `backend/internal/http/router.go` and wire `cfg.PublicAppURL` and `cfg.CentralAuthURL` / `cfg.AuthJWTIssuer` origin in `backend/cmd/api/main.go`
- [X] T002 Add `gateway *auth.GatewayClient`, `verifier *auth.JWTVerifier`, `publicAppURL string`, `publicAuthOrigin string`, `mu sync.Mutex`, and `pickupCodes map[string]pickupEntry` to `authHandler` struct and constructor initialization in `backend/internal/http/auth_handler.go` and `backend/internal/http/router.go`

---

## Phase 2: Foundational (Platform Gateway Client Primitives)

**Purpose**: Core `GatewayClient` methods required by BFF callback, session confirmation middleware, and logout handlers.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Implement `ExchangeResponse` struct (`SessionHandle` `"Non-empty, prefixed with \"v1.\""`, `Subject` `"Non-empty Keycloak user sub UUID"`, `Issuer` `"Non-empty realm issuer URL"`, `Audience` `"Must equal \"project-pn\""`, `ExpiresIn` `"Session TTL in seconds (e.g., 28800 for 8h; defaults to 28800 if <= 0)"`) and `ExchangeTicket(ctx context.Context, host, ticket string) (*ExchangeResponse, error)` calling `POST /auth/exchange` with `X-Forwarded-Host` in `backend/internal/auth/gateway_client.go`
- [X] T004 Implement `ConfirmSessionHandle(ctx context.Context, host, sessionHandle string) (*ConfirmedIdentity, string, error)` calling `GET /auth` with `Authorization: Bearer v1.<session_handle>` and `X-Forwarded-Host`, validating the returned Keycloak access JWT claims (`aud = project-pn`, `iss`, `sub`, `exp`), and returning `(ident, X-Refreshed-Session-Handle, err)` in `backend/internal/auth/gateway_client.go`
- [X] T005 Implement `LogoutSessionHandle(ctx context.Context, sessionHandle string) error` calling `POST /auth/logout` with `Authorization: Bearer v1.<session_handle>` in `backend/internal/auth/gateway_client.go`
- [X] T006 [P] Add unit tests for `ExchangeTicket`, `ConfirmSessionHandle` (including `X-Refreshed-Session-Handle` and foreign audience rejection), and `LogoutSessionHandle` using runtime base64 JWT encoding (no static `eyJ...` literals) in `backend/internal/auth/gateway_client_test.go`

**Checkpoint**: `GatewayClient` supports `ExchangeTicket`, `ConfirmSessionHandle`, and `LogoutSessionHandle` with unit tests passing.

---

## Phase 3: User Story 1 - Browser Learner Completes Cookie-Free BFF Sign-In (Priority: P1) 🎯 MVP

**Goal**: Enable browser web learners to sign in via `GET /api/auth/login` -> platform `/oauth/start` -> `GET /api/auth/callback` -> frontend `?code=` pickup via `POST /api/auth/session` without cross-subdomain session cookies.

**Independent Test**: Trigger browser web sign-in, follow the redirect to `/api/auth/login`, complete `/api/auth/callback` with a matching `__Host-pa_nonce` cookie and valid ticket, exchange the resulting 32-char hex `?code=` at `POST /api/auth/session`, and verify the frontend scrubs `?code=` from the URL and returns `SessionResponse`.

### Implementation for User Story 1

- [X] T007 [US1] Implement `GET /api/auth/login` (`ah.login`) generating `"32 lowercase hex chars (16 random bytes); stored in __Host-pa_nonce cookie (Path=/, MaxAge=600, HttpOnly, Secure, SameSite=Lax)"`, computing `BindDigest` as `"base64.RawURLEncoding(sha256(Nonce)); passed in callback URL query ?pa_bind=..."`, and `302` redirecting to `${PUBLIC_AUTH_ORIGIN}/oauth/start?return=${url.QueryEscape(callbackURL)}` in `backend/internal/http/auth_handler.go`
- [X] T008 [US1] Implement `GET /api/auth/callback` (`ah.callback`) verifying `__Host-pa_nonce` cookie against `pa_bind` via `subtle.ConstantTimeCompare`, clearing `__Host-pa_nonce` (`MaxAge: -1`), calling `gateway.ExchangeTicket`, verifying `exch.Audience == "project-pn"`, confirming session handle claims, calling `EnsurePlatformUser(r.Context(), exch.Issuer, exch.Subject, email, "google")`, storing a `"32 lowercase hex chars (16 random bytes)"` pickup code with `"now.Add(30 * time.Second)"` TTL, and `302` redirecting to `${PUBLIC_APP_URL}/?code=${code}` in `backend/internal/http/auth_handler.go`
- [X] T009 [US1] Implement `POST /api/auth/session` (`ah.session`) returning `200 OK` JSON `{ "token": "v1.<session_handle>", "refresh_token": "v1.<session_handle>", "expires_at": "<RFC3339>" }` and register unauthenticated `GET /login`, `GET /callback`, and `POST /session` routes under `/api/auth` in `backend/internal/http/auth_handler.go` and `backend/internal/http/router.go`
- [X] T010 [P] [US1] Update browser web `handleSignIn()` to navigate to `${API_BASE_URL}/api/auth/login` in `frontend/src/screens/CentralAuthScreen.tsx`
- [X] T011 [P] [US1] Update `parseSessionFromLaunchUrl()` when `isBrowserWeb()` is true to read `new URLSearchParams(window.location.search).get('code')`, immediately scrub `code` from the URL bar using `window.history.replaceState({}, document.title, cleanUrl)`, and call `POST ${API_BASE_URL}/api/auth/session` with `{"code": code}` in `frontend/src/utils/authLaunch.ts`
- [X] T012 [P] [US1] Add unit tests verifying web `parseSessionFromLaunchUrl()` `?code=` pickup exchange and `window.history.replaceState` URL scrubbing in `frontend/src/utils/authLaunch.test.ts`

**Checkpoint**: User Story 1 end-to-end BFF login, callback, and frontend `?code=` pickup exchange work independently.

---

## Phase 4: User Story 2 - Authenticated API Requests & Seamless Session Rotation via Sealed Session Handles (Priority: P1)

**Goal**: Authorize protected API requests carrying `Authorization: Bearer v1.<session_handle>` by confirming the handle with the internal platform gateway, verifying the underlying Keycloak access JWT via `JWTVerifier`, and propagating `X-Refreshed-Session-Handle` when rotated.

**Independent Test**: Send a protected request (`GET /api/auth/me`) with `Authorization: Bearer v1.<session_handle>`; verify `gateway.ConfirmSessionHandle` and `verifier.Verify` execute, the learner profile is returned, `X-Refreshed-Session-Handle` is copied to the response header when rotated, and invalid/expired handles return `401 Unauthorized` (`AUTH-101`).

### Implementation for User Story 2

- [X] T013 [US2] Update `authMiddleware` to detect `Bearer v1.<session_handle>` (`strings.HasPrefix(token, "v1.")`), call `gateway.ConfirmSessionHandle(r.Context(), r.Host, token)`, return `401 Unauthorized` (`AUTH-101`) on error or nil identity, set response header `X-Refreshed-Session-Handle` when `refreshedHandle != ""`, verify `ident.Token` via `verifier.Verify`, and preserve the original `v1.<session_handle>` in `authSession.credential` in `backend/internal/http/auth_middleware.go`
- [X] T014 [US2] Add middleware unit tests for valid `Bearer v1.<session_handle>`, `X-Refreshed-Session-Handle` header propagation, preserved `v1.<session_handle>` in `authSession`, and rejected/unreachable `v1.` handles in `backend/internal/http/auth_middleware_test.go`

**Checkpoint**: Protected endpoints accept and verify `Bearer v1.<session_handle>` and propagate rotated session handles.

---

## Phase 5: User Story 3 - Attack Prevention: Login CSRF, Replay, and Payload Abuse Protection (Priority: P1)

**Goal**: Enforce all Spec 009 security gates (`CWE-352` Login CSRF binding, `CWE-770` 4 KB body cap, `CWE-384` single-use 30s pickup code eviction, and `Gitleaks` runtime JWT test generation) with comprehensive negative test coverage.

**Independent Test**: Run negative tests against `/api/auth/callback` (missing/tampered `__Host-pa_nonce`, expired/replayed gateway ticket, wrong audience) and `/api/auth/session` (oversized >4KB body, malformed code length, replayed code, expired >30s code).

### Implementation for User Story 3

- [X] T015 [US3] Enforce `r.Body = http.MaxBytesReader(w, r.Body, 4<<10)` (`CWE-770`), `len(strings.TrimSpace(body.Code)) == 32` check (`400 Bad Request`), and mutex-protected single-use deletion + expired entry eviction (`now.After(entry.ExpiresAt)`, `CWE-384`) on `POST /api/auth/session` in `backend/internal/http/auth_handler.go`
- [X] T016 [US3] Add integration tests covering `/api/auth/login` cookie attributes, `/api/auth/callback` Login CSRF rejection (`400 Bad Request` on missing/mismatched `__Host-pa_nonce`), graceful `302` redirect to `/` on failed ticket exchange, and `/api/auth/session` 4 KB body limit (`400`), invalid code length (`400`), single-use replay rejection (`401`), and 30s TTL expiry (`401`) in `backend/internal/http/auth_handler_test.go`

**Checkpoint**: All CWE-352, CWE-384, and CWE-770 security gates are enforced and verified by automated tests.

---

## Phase 6: User Story 4 - Explicit Session Revocation on Logout (Priority: P2)

**Goal**: Revoke `v1.<session_handle>` credentials at the internal platform gateway (`POST /auth/logout`) when an authenticated learner calls `POST /api/auth/logout`.

**Independent Test**: Call `POST /api/auth/logout` with `Authorization: Bearer v1.<session_handle>` and verify the backend invokes `gateway.LogoutSessionHandle(ctx, "v1.<session_handle>")` and returns `204 No Content` (or `401 Unauthorized` if gateway revocation fails).

### Implementation for User Story 4

- [X] T017 [US4] Update `centralLogout` in `backend/internal/http/auth_handler.go` and route registration in `backend/internal/http/router.go` to accept `gateway *auth.GatewayClient` and call `gateway.LogoutSessionHandle(r.Context(), session.credential)` when `strings.HasPrefix(session.credential, "v1.")`
- [X] T018 [US4] Add integration test for `POST /api/auth/logout` with `Bearer v1.<session_handle>` verifying gateway `/auth/logout` invocation and `204 No Content` response in `backend/internal/http/auth_handler_test.go`

**Checkpoint**: All user stories (`US1`–`US4`) are implemented and independently tested.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Full repository verification, Add-tab invariant check, type safety, and Gitleaks scan.

- [X] T019 Run serial backend test suite (`cd backend && set -a && source .env && set +a && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`) and verify all packages pass
- [X] T020 [P] Run frontend test suites (`npm test -w frontend -- --watchAll=false` and `npm test -w frontend -- --testPathPattern=AddScreen --watchAll=false`) and typechecks (`npm run typecheck -w frontend` and `npm run typecheck -w packages/api`)
- [X] T021 [P] Run static secret/JWT literal check (`rg "eyJ[A-Za-z0-9_-]{10,}" backend/ frontend/`) to confirm zero hardcoded base64 JWT literals (`Gitleaks` compliance)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — starts immediately (`T001`–`T002`).
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks `US1`, `US2`, `US3`, and `US4` (`T003`–`T006`).
- **Phase 3 (`US1` - BFF Sign-In)**: Depends on Phase 2 (`T007`–`T012`).
- **Phase 4 (`US2` - Bearer `v1.` Middleware)**: Depends on Phase 2 (`T013`–`T014`); can proceed in parallel with `US1` frontend tasks (`T010`–`T012`).
- **Phase 5 (`US3` - Security Gates & Negative Tests)**: Depends on `US1` endpoints (`T015`–`T016`).
- **Phase 6 (`US4` - `v1.` Logout Revocation)**: Depends on Phase 2 and `US2` session context preservation (`T017`–`T018`).
- **Phase 7 (Polish & Verification)**: Depends on Phases 1–6 completion (`T019`–`T021`).

### Parallel Opportunities

- `T006` (`gateway_client_test.go`) can be written immediately alongside `T003`–`T005`.
- `T010` (`CentralAuthScreen.tsx`), `T011` (`authLaunch.ts`), and `T012` (`authLaunch.test.ts`) touch `frontend/` and can run in parallel with backend tasks `T007`–`T009` and `T013`–`T014`.
- `T020` (frontend tests/typechecks) and `T021` (`rg` secret scan) can run in parallel with `T019` (serial Go tests).

---

## Parallel Example: User Story 1 & User Story 2

```bash
# Backend BFF & Middleware tasks:
Task T007-T009: Implement /api/auth/login, /api/auth/callback, /api/auth/session in backend/internal/http/auth_handler.go
Task T013: Update authMiddleware for Bearer v1.<session_handle> in backend/internal/http/auth_middleware.go

# Parallel Frontend tasks:
Task T010: Update CentralAuthScreen.tsx to redirect to ${API_BASE_URL}/api/auth/login
Task T011-T012: Update authLaunch.ts and authLaunch.test.ts for ?code= pickup exchange
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational `GatewayClient` methods).
2. Complete Phase 3 (`US1` BFF login/callback/session + frontend launch) and Phase 4 (`US2` `Bearer v1.<session_handle>` middleware).
3. Complete Phase 5 (`US3` CWE-352/384/770 security gates) and Phase 6 (`US4` logout revocation).
4. Execute Phase 7 full serial backend + frontend verification gates.

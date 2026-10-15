# Implementation Plan: 4-Layer Cookie-Free BFF & Sealed Session Handle Authentication

**Branch**: `003-bff-session-handle-auth` | **Date**: 2026-10-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-bff-session-handle-auth/spec.md` and handoff `docs/handoff-spec009-bff-auth.md`

## Summary

Implement the Project PN side of `nacfson_pipeline` Spec 009 by replacing cross-subdomain `PLATFORM_SESSION` cookies with a 4-layer cookie-free Backend-For-Frontend (BFF) and internal platform gateway sealed `session_handle` (`v1.<session_handle>`) flow:

1. **Backend BFF Routes (`backend/internal/http/auth_handler.go` & `router.go`)**:
   - `GET /api/auth/login`: Generates a 16-byte random hex `nonce`, sets a host-only `__Host-pa_nonce` cookie (`10m` TTL, `HttpOnly`, `Secure`, `SameSite=Lax`), and `302` redirects to `${PUBLIC_AUTH_ORIGIN}/oauth/start?return=${callbackURL}` with `pa_bind=<base64url(sha256(nonce))>`.
   - `GET /api/auth/callback`: Verifies `__Host-pa_nonce` against `pa_bind` via `subtle.ConstantTimeCompare` (`CWE-352`), clears `__Host-pa_nonce`, exchanges `ticket` via internal `POST /auth/exchange`, verifies `audience == "project-pn"`, confirms the session handle to extract claims and calls `EnsurePlatformUser`, stores a 30-second single-use 32-char hex pickup code in memory (`CWE-384`), and `302` redirects to `${PUBLIC_APP_URL}/?code=${code}`.
   - `POST /api/auth/session`: Enforces a 4 KB `http.MaxBytesReader` limit (`CWE-770`), validates `len(code) == 32`, atomically consumes the single-use pickup code while evicting expired entries, and returns `{ token: "v1.<session_handle>", refresh_token: "v1.<session_handle>", expires_at }`.
2. **Gateway Client & Auth Middleware (`backend/internal/auth/gateway_client.go` & `backend/internal/http/auth_middleware.go`)**:
   - Add `ConfirmSessionHandle`, `ExchangeTicket`, and `LogoutSessionHandle` to `GatewayClient`.
   - Update `authMiddleware` so `Bearer v1.<session_handle>` tokens are confirmed via `gateway.ConfirmSessionHandle`, any `X-Refreshed-Session-Handle` is copied to the response header, the underlying Keycloak JWT is verified by `JWTVerifier`, and the original `v1.<session_handle>` is preserved in `authSession` for `POST /api/auth/logout`.
3. **Frontend Web Launch & Sign-In (`frontend/src/screens/CentralAuthScreen.tsx` & `frontend/src/utils/authLaunch.ts`)**:
   - Update `CentralAuthScreen.tsx` browser web sign-in to navigate to `${API_BASE_URL}/api/auth/login`.
   - Update `parseSessionFromLaunchUrl()` in `authLaunch.ts` on browser web to read `?code=`, scrub the URL via `window.history.replaceState`, and exchange the code via `POST ${API_BASE_URL}/api/auth/session`.

## Technical Context

**Language/Version**: Go `1.26.0` (backend), TypeScript `5.x` / Node.js `22` / React Native (Expo) (frontend)

**Primary Dependencies**: `github.com/go-chi/chi/v5`, `github.com/lestrrat-go/jwx/v3`, `github.com/jackc/pgx/v5`, React Native / Expo Web, `@project-pn/api`

**Storage**: Local PostgreSQL 16 (existing `users` & `user_identities` tables unchanged); in-memory mutex-protected map with 30s TTL for single-use pickup codes

**Testing**: `GOTOOLCHAIN=go1.26.0 go test -p 1 ./...` (serial Go tests), `npm test -w frontend` (Jest), `npm run typecheck -w frontend`

**Target Platform**: Oracle Cloud k3s (arm64 Linux pods behind Traefik + `gateway.identity.svc:8080`), Expo Web (`pn.nacfson.cloud`), iOS/Android/Tauri

**Project Type**: Full-stack web/mobile vocabulary learning application (`backend/` Go API + `frontend/` Expo client)

**Performance Goals**: `< 50ms` p95 internal cluster gateway confirmation (`GET /auth`) and ticket exchange (`POST /auth/exchange`); zero unbounded memory growth on pickup code map

**Constraints**:
- `POST /api/auth/session` MUST cap request body at `4<<10` (4 KB) via `http.MaxBytesReader` (`CWE-770`)
- `GET /api/auth/callback` MUST verify `__Host-pa_nonce` against `pa_bind` via `subtle.ConstantTimeCompare` (`CWE-352`)
- Pickup codes MUST be 32-char hex, single-use, and expire in 30 seconds (`CWE-384`)
- No hardcoded `eyJ...` base64 JWT literals in tests (`Gitleaks` compliance)
- `AddScreen` Manual-first invariant MUST remain untouched

**Scale/Scope**: 6 core source files + unit/integration test suites across `backend/` and `frontend/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Standard | Status | Evaluation |
| :--- | :--- | :--- |
| **I. Sense-Level Learning** | PASS | No changes to vocabulary or sense learning tables (`user_word_senses`). |
| **II. Spaced Repetition & Attempt Immutability** | PASS | No changes to `review_states` or `review_attempts`. |
| **III. Lean MVP Schema & Architecture Isolation** | PASS | Zero database schema changes; ephemeral 30s pickup codes live in memory; underlying Keycloak access JWT is still verified by `JWTVerifier` via cluster JWKS. |
| **IV. Cross-Platform Consistency & Product UI Invariants** | PASS | `AddScreen.tsx` cluster is untouched; `AddScreen.test.tsx` continues to assert Manual-first default. |
| **V. Rigorous Testing & Serial Execution Discipline** | PASS | All Go tests run serially (`go test -p 1 ./...`); frontend Jest and TypeScript checks included in verification gate. |
| **Identity & Authentication Security Standards** | PASS | Platform gateway owns OIDC brokering and session sealing; Project PN verifies the underlying project-scoped access JWT (`aud = project-pn`) and resolves `(issuer, subject)` to ordinary learner access only. |

**Post-Design Re-Check**: All gates PASS with zero violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-bff-session-handle-auth/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── bff-auth-api.md  # Phase 1 HTTP & Gateway contracts
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
backend/
├── cmd/
│   └── api/
│       └── main.go                          # Pass PublicAppURL to httpapi.Dependencies
└── internal/
    ├── auth/
    │   ├── gateway_client.go                # Add ConfirmSessionHandle, ExchangeTicket, LogoutSessionHandle
    │   └── gateway_client_test.go           # Unit tests for v1 session handle confirm/exchange/logout
    └── http/
        ├── auth_handler.go                  # Add login, callback, session BFF handlers + v1 logout support
        ├── auth_handler_test.go             # Integration tests for login/callback/session/logout & CWE gates
        ├── auth_middleware.go               # Unwrap Bearer v1.<session_handle> via gateway + propagate rotation header
        ├── auth_middleware_test.go          # Middleware tests for Bearer v1.<session_handle> & rotation header
        └── router.go                        # Wire PublicAppURL & register /api/auth/{login,callback,session}

frontend/
└── src/
    ├── screens/
    │   ├── CentralAuthScreen.tsx            # Redirect web sign-in to ${API_BASE_URL}/api/auth/login
    │   └── CentralAuthScreen.test.tsx       # Verify web sign-in redirect target
    └── utils/
        ├── authLaunch.ts                    # Exchange ?code= via POST /api/auth/session & history.replaceState
        └── authLaunch.test.ts               # Unit tests for web ?code= pickup exchange & URL scrubbing
```

**Structure Decision**: Existing monorepo layout (`backend/` Go module + `frontend/` Expo workspace). All changes slot directly into the established `internal/auth`, `internal/http`, `frontend/src/screens`, and `frontend/src/utils` packages without adding new packages or database migrations.

## Complexity Tracking

No Constitution violations — table omitted.

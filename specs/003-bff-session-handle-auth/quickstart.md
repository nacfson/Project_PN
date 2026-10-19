# Quickstart & Validation Guide: 4-Layer Cookie-Free BFF & Sealed Session Handle Auth

**Feature**: `003-bff-session-handle-auth`  
**Date**: 2026-10-15

---

## 1. Prerequisites

- Go `1.26.0` (`GOTOOLCHAIN=go1.26.0`)
- Node.js `22+` and `npm` workspaces installed
- Local PostgreSQL running on port `5433` (`docker compose -f backend/compose.yaml --env-file backend/.env up -d`) with migrations applied (`cd backend && set -a && source .env && set +a && go run ./cmd/migrate up`)

---

## 2. Automated Verification Commands

### 2.1 Backend Auth & HTTP Test Suite (Serial Execution)

Run the focused auth and HTTP handler/middleware tests first, then the full backend suite serially (per Constitution Principle V):

```bash
cd backend && set -a && source .env && set +a
GOTOOLCHAIN=go1.26.0 go test -p 1 -v ./internal/auth/... ./internal/http/... -count=1
GOTOOLCHAIN=go1.26.0 go test -p 1 ./...
```

**Expected Outcomes**:
- `gateway_client_test.go` verifies `ConfirmSessionHandle` (including `X-Refreshed-Session-Handle` and audience validation), `ExchangeTicket`, and `LogoutSessionHandle`.
- `auth_middleware_test.go` verifies `Bearer v1.<session_handle>` confirmation + JWKS verification, header rotation propagation, and preserving `v1.<session_handle>` in `authSession`.
- `auth_handler_test.go` verifies:
  - `GET /api/auth/login` sets `__Host-pa_nonce` and redirects to `/oauth/start?return=...pa_bind=...`.
  - `GET /api/auth/callback` rejects missing/mismatched `__Host-pa_nonce` (`400 Bad Request`), redirects to `/` on invalid ticket, and issues a 30s 32-char hex `?code=` on valid ticket exchange.
  - `POST /api/auth/session` enforces the 4 KB `http.MaxBytesReader` limit (`400 Bad Request`), enforces single-use 30s TTL (`200 OK` on first use, `401 Unauthorized` on replay or expiry), and returns `{ token, refresh_token, expires_at }`.
  - `POST /api/auth/logout` revokes `v1.<session_handle>` via the gateway.

### 2.2 Frontend Unit Tests & Typechecks

```bash
npm test -w frontend -- --watchAll=false
npm test -w frontend -- --testPathPattern=AddScreen --watchAll=false
npm run typecheck -w frontend
npm run typecheck -w packages/api
```

**Expected Outcomes**:
- `CentralAuthScreen` browser web sign-in navigates to `${API_BASE_URL}/api/auth/login`.
- `authLaunch.ts` detects `?code=`, removes it via `window.history.replaceState`, and posts to `${API_BASE_URL}/api/auth/session`.
- `AddScreen.test.tsx` continues to pass the Manual-first product lock invariant.

### 2.3 Security Audit Checks (`Gitleaks` / CWE Compliance)

```bash
rg "eyJ[A-Za-z0-9_-]{10,}" backend/ frontend/
```

**Expected Outcome**: Zero hardcoded base64 JWT literals in test or production files.

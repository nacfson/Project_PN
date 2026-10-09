# Implementation Plan: Gateway JWT Auth Verification & Platform Identity Migration

**Branch**: `001-gateway-jwt-auth` | **Date**: 2026-10-07 (Updated 2026-10-09) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-gateway-jwt-auth/spec.md` and Platform Identity Migration Runbook (`backend/docs/platform-identity-migration.md`).

## Summary

Replace Project PN’s per-request **central-auth / ProcessManager-era session validation** with **local verification of Keycloak project-scoped access JWTs** (`aud = project-pn`, `iss = https://auth.nacfson.cloud/realms/platform`) injected by the platform gateway (ForwardAuth). Preserve the existing `users` / learning database; bind accounts to `(issuer, subject)` via **operator migration**. Live brokered sign-in method this delivery: **Google only** (schema-ready for later Apple/Email). **No application-admin role** — remove app-admin authorization from this codebase. Accept **access tokens for this project’s audience only** (reject ID tokens). Hard-cutover production away from central-auth credentials and eliminate ProcessManager / `auth.nacfson.cloud` auth remnants from Project PN code, build scripts, and docs. Fix the frontend initialization bug that fails open on backend network errors.

Technical approach (see [research.md](./research.md)): JWKS-backed JWT verify in Go middleware (in-cluster JWKS endpoint) → resolve/create local user by `(iss, sub)` in `user_identities` → ordinary capabilities only + deny cross-user private data.

## Technical Context

**Language/Version**: Go 1.26 (backend); TypeScript / React Native Expo (frontend clients)

**Primary Dependencies**: chi, pgx (existing); add JWT/JWKS library (`lestrrat-go/jwx/v3` or v2 per research); platform Keycloak + Traefik ForwardAuth (external cluster services)

**Storage**: PostgreSQL 16 — evolve `user_identities` for `(issuer, subject)` + `sign_in_method`; **no** `admin_bindings` / app-admin authorization schema; preserve `users` and learning tables; drop or ignore `is_admin` for product authz

**Testing**: `GOTOOLCHAIN=go1.26.0 go test -p 1 ./...` (serial); frontend `npm test -w frontend` / typecheck; JWT accept/reject matrix + ordinary/cross-user authz tests required

**Target Platform**: Oracle k3s hosted Project PN behind platform Traefik (`nacfson_pipeline`); multi-client (web, native, desktop, extension) presenting Bearer access JWT

**Project Type**: Multiplatform app + Go HTTP API (npm workspaces + `backend/`)

**Performance Goals**: Auth verify adds negligible latency vs today’s central-auth HTTP round-trip; JWKS cached in-memory with automatic refresh on unknown `kid`; fail closed if JWKS unreachable

**Constraints**: Never trust `X-User-*` alone; accept only project-audience **access** JWTs (`aud = project-pn`); no project-owned browser OIDC / Google login bypass; email not primary identity key; production hard cutover (no dual-stack); in-cluster JWKS URL under NetworkPolicy; no ProcessManager auth path; no app-admin product role; frontend must fail closed on initial auth errors

**Scale/Scope**: Auth middleware + identity schema + operator migration + client Bearer updates + removal of app-admin, `auth.nacfson.cloud` redirects, and ProcessManager/central-auth session remnants; Google-only live; Apple/Email deferred

## Concrete Change Inventory (in-repo purpose)

This feature’s purpose in **this repository** is explicit. Specs alone are not the deliverable — the following code/docs must change during implementation.

**Primary implement slice (confirmed): A — Replace old session auth path.** Deliver JWT verify + local user resolution + frontend fail-closed fix before B/C cleanup polish. B and C remain in-feature but ordered after A works.

### A. Replace (primary — old session auth path)

| Path | Purpose of change |
|------|-------------------|
| `backend/internal/auth/central_client.go` | Remove/replace `ValidateSession`, cookie-session, refresh/logout against central-auth; stop carrying session `IsAdmin`; retire production `mock-dev-token` shortcut (non-prod bypass only if gated via `AUTH_DEV_BYPASS`) |
| `backend/internal/http/auth_middleware.go` | Verify project **access** JWT locally via JWKS; resolve `(issuer, subject)` → local user; do not call central-auth |
| `backend/cmd/api/main.go` | Wire `AUTH_JWT_*` config (`AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, `AUTH_JWT_JWKS_URL`); stop requiring `CENTRAL_AUTH_*` session client for production auth |
| `backend/internal/http/auth_handler.go` | `/api/auth/me` for platform identity; deprecate/remove central-auth refresh proxy; logout via platform |
| `backend/internal/auth/platform_user.go` | `EnsurePlatformUser` by `(issuer, subject)`; no same-email auto-link as primary continuity; no app-admin grant (replaces `central_user.go`) |
| `frontend/App.tsx` | Fix fatal fallthrough bug in `checkAuth` catch block: on backend connection/network errors, strictly set `setAuthState('unauthenticated')` with error banner rather than defaulting to `authenticated` |
| `frontend/src/screens/CentralAuthScreen.tsx` | Stop redirecting to `auth.nacfson.cloud/login`; align with platform gateway login |
| `frontend/src/config.ts`, `frontend/.env.example` | Remove `EXPO_PUBLIC_CENTRAL_AUTH_URL` / `auth.nacfson.cloud` fallbacks; align API base URLs |
| `scripts/push-ghcr.sh`, `.github/workflows/publish-ghcr-images.yml` | Remove hardcoded `EXPO_PUBLIC_CENTRAL_AUTH_URL=https://auth.nacfson.cloud` and the assertion failing builds if absent |
| `frontend/src/api/auth.ts`, `frontend/src/utils/authLaunch.ts` | Send `Authorization: Bearer <project access JWT>` only |
| `packages/api/src/auth.ts` | DTO alignment for identity metadata without app-admin role |

### B. Remove app-admin product authorization (narrow)

| In scope | Out of scope (do **not** delete as “admin feature”) |
|----------|------------------------------------------------------|
| Stop using `IsAdmin` / `is_admin` from session payloads for **product authorization** in Project PN | `backend/internal/admin/` **logging/metrics** package — not an application-admin role; may remain or be renamed later |
| Do not add `admin_bindings` or admin-gated learner APIs | Entire `central-auth/` service deploy retirement (separate ops decision; PN must not depend on it after cutover) |
| Tests/docs must not describe app-admin capabilities | |

Project PN today has little/no learner API gated by admin role; cleanup is mainly stopping the identity path from importing admin powers.

### C. ProcessManager auth remnants (mostly docs)

There is **no** ProcessManager auth implementation package inside Project PN. Remnants are wording that still presents ProcessManager as an auth rollback/authority option.

| Path | Purpose of change |
|------|-------------------|
| `backend/docs/oracle-deploy-runbook.md` | Auth = platform Keycloak / gateway JWT; remove “roll back to processmanager” auth guidance |
| `backend/docs/cursor-secrets.md` | Drop/retire central-auth cookie internal-token secrets as production PN auth; document `AUTH_JWT_*` |
| `deploy/deploy-exception-runbook.md` | Auth failures → JWT/JWKS/issuer/audience, not ProcessManager |
| `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` | Task routing: platform JWT verification, not ProcessManager / central-auth session validation |

### D. Explicit non-goals for this plan

- Platform SSO idle/max lifetime and silent refresh (Keycloak/gateway own this)
- Implementing Apple/Email login brokers (schema may reserve values only)
- Building application-admin product features
- Rewriting learning/FSRS schema
- Deleting `backend/internal/admin` logging solely because of the name “admin”

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Sense-level learning | PASS | No change to learnable unit / global vs personal split |
| II. Attempt immutability / FSRS | PASS | Auth-only; no review_attempts mutation model change |
| III. Lean MVP schema | PASS with care | Additive identity columns only; no `user_words` revival; no admin_bindings table |
| IV. Cross-platform + Add-tab lock | PASS | Auth entry changes must not touch Add-tab default `'manual'` |
| V. Serial tests / typecheck | PASS | Plan requires serial Go tests + frontend checks |
| Identity (constitution text) | **PASS** | Constitution **1.1.1** — gateway JWT + `(issuer, subject)`; no app-admin role; ProcessManager not an auth authority |
| Secrets / k8s | PASS | Issuer, audience, JWKS URL, alg allowlist via env/Cursor secrets — no private Keycloak keys in repo |

**Post–Phase 1 re-check**: Design keeps learning schema intact; no app-admin role; ProcessManager auth remnants targeted for removal; constitution 1.1.1 aligned — **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/001-gateway-jwt-auth/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── jwt-verification.md
│   ├── ordinary-role.md
│   ├── operator-migration.md
│   └── auth-api-surface.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
backend/
├── cmd/api/main.go                 # wire JWT verifier config; drop central-auth client
├── internal/config/                # AUTH_JWT_* env (no ProcessManager auth)
├── internal/auth/                  # JWKS verifier; EnsurePlatformUser; remove session client
├── internal/http/auth_middleware.go
├── internal/http/auth_handler.go   # me/logout; no admin role APIs
└── db/migrations/                  # user_identities issuer/subject + method; drop is_admin authz use

frontend/
├── App.tsx                         # fail closed on connection error; no auto-login fallthrough
├── src/api/auth.ts                 # Bearer access JWT only
├── src/screens/CentralAuthScreen.tsx # remove auth.nacfson.cloud/login redirects
├── src/utils/authLaunch.ts         # drop central-auth / ProcessManager assumptions
└── .env.example

packages/api/src/auth.ts

backend/docs/                       # oracle-deploy / exception runbooks: no ProcessManager auth
AGENTS.md / CLAUDE.md / GEMINI.md   # auth routing: platform JWT, not ProcessManager
```

**Structure Decision**: Existing monorepo — backend auth + docs cleanup are primary; frontend credential path and fail-closed bug fix; no new top-level app.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Identity schema migration | `(issuer, subject)` + method metadata required | Reusing Google-only `(provider, provider_subject)` without issuer blocks multi-method future |
| Remove app-admin + ProcessManager auth remnants | User decision to eliminate dual/legacy auth and unused admin role | Keeping remnants leaves confusing second auth paths |
| Fail-closed catch block rewrite in App.tsx | Prevents unauthenticated users from entering the app when backend connection fails | Bypassing auth on network error breaks product security invariant |

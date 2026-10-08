# Implementation Plan: Gateway JWT Auth Verification

**Branch**: `001-gateway-jwt-auth` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-gateway-jwt-auth/spec.md`

## Summary

Replace Project PN’s per-request **central-auth / ProcessManager-era session validation** with **local verification of Keycloak project-scoped access JWTs** injected by the platform gateway (ForwardAuth). Preserve the existing `users` / learning database; bind accounts to `(issuer, subject)` via **operator migration**. Live brokered sign-in method this delivery: **Google only** (schema-ready for later Apple/Email). **No application-admin role** — remove app-admin authorization from this codebase. Accept **access tokens for this project’s audience only** (reject ID tokens). Hard-cutover production away from central-auth credentials and eliminate ProcessManager auth remnants from Project PN code/docs.

Technical approach (see [research.md](./research.md)): JWKS-backed JWT verify in Go middleware → resolve/create local user by `(iss, sub)` → ordinary capabilities only + deny cross-user private data.

## Technical Context

**Language/Version**: Go 1.26 (backend); TypeScript / React Native Expo (frontend clients)

**Primary Dependencies**: chi, pgx (existing); add JWT/JWKS library (`lestrrat-go/jwx` per research); platform Keycloak + Traefik ForwardAuth (external)

**Storage**: PostgreSQL 16 — evolve `user_identities` for `(issuer, subject)` + `sign_in_method`; **no** `admin_bindings` / app-admin authorization schema; preserve `users` and learning tables; drop or ignore `is_admin` for product authz

**Testing**: `GOTOOLCHAIN=go1.26.0 go test -p 1 ./...` (serial); frontend `npm test -w frontend` / typecheck; JWT accept/reject matrix + ordinary/cross-user authz tests required

**Target Platform**: Oracle k3s hosted Project PN behind platform Traefik; multi-client (web, native, desktop, extension) presenting Bearer access JWT

**Project Type**: Multiplatform app + Go HTTP API (npm workspaces + `backend/`)

**Performance Goals**: Auth verify adds negligible latency vs today’s central-auth HTTP round-trip; JWKS cached; fail closed if JWKS unreachable

**Constraints**: Never trust `X-User-*` alone; accept only project-audience **access** JWTs; no project-owned browser OIDC; email not primary identity key; production hard cutover; cluster-network JWKS URL; no ProcessManager auth path; no app-admin product role

**Scale/Scope**: Auth middleware + identity schema + operator migration + client Bearer updates + removal of app-admin and ProcessManager/central-auth session remnants; Google-only live; Apple/Email deferred

## Concrete change inventory (in-repo purpose)

This feature’s purpose in **this repository** is explicit. Specs alone are not the deliverable — the following code/docs must change during implement.

**Primary implement slice (confirmed): A — Replace old session auth path.** Deliver JWT verify + local user resolution before B/C cleanup polish. B and C remain in-feature but ordered after A works.

### A. Replace (primary — old session auth path)

| Path | Purpose of change |
|------|-------------------|
| `backend/internal/auth/central_client.go` | Remove/replace `ValidateSession`, cookie-session, refresh/logout against central-auth; stop carrying session `IsAdmin`; retire production `mock-dev-token` shortcut (non-prod bypass only if gated) |
| `backend/internal/http/auth_middleware.go` | Verify project **access** JWT locally (JWKS); resolve `(issuer, subject)` → local user; do not call central-auth |
| `backend/cmd/api/main.go` | Wire `AUTH_JWT_*` config; stop requiring `CENTRAL_AUTH_*` session client for production auth |
| `backend/internal/http/auth_handler.go` | `/api/auth/me` for platform identity; deprecate/remove central-auth refresh proxy; logout via platform |
| `backend/internal/auth/central_user.go` (→ platform user) | `EnsurePlatformUser` by `(issuer, subject)`; no same-email auto-link as primary continuity; no app-admin grant |
| `frontend/src/screens/CentralAuthScreen.tsx` | Stop using central-auth `/login` as production IdP; align with platform gateway login |
| `frontend/src/config.ts`, `frontend/.env.example` | Replace `EXPO_PUBLIC_CENTRAL_AUTH_URL` assumptions with platform auth/API URLs |
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

- Platform SSO idle/max lifetime and silent refresh (Keycloak/gateway)
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
├── src/api/auth.ts                 # Bearer access JWT only
├── src/utils/authLaunch.ts         # drop central-auth / ProcessManager assumptions
└── .env.example

packages/api/src/auth.ts

backend/docs/                       # oracle-deploy / exception runbooks: no ProcessManager auth
AGENTS.md / CLAUDE.md / GEMINI.md   # auth routing: platform JWT, not ProcessManager
```

**Structure Decision**: Existing monorepo — backend auth + docs cleanup are primary; frontend credential path only; no new top-level app.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Identity schema migration | `(issuer, subject)` + method metadata required | Reusing Google-only `(provider, provider_subject)` without issuer blocks multi-method future |
| Remove app-admin + ProcessManager auth remnants | User decision to eliminate dual/legacy auth and unused admin role | Keeping remnants leaves confusing second auth paths |

# Tasks: Gateway JWT Auth Verification

**Input**: Design documents from `/specs/001-gateway-jwt-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — spec FR-015 / contracts require accept-reject and authorization matrices.

**Out of scope for these tasks**: Platform SSO idle/max lifetime, Keycloak Google broker UI, Traefik ForwardAuth implementation (platform-owned). PN only verifies JWTs and resolves local accounts.

**Organization**: Grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: US1–US5 map to spec user stories
- Exact file paths in every task

## Path Conventions

- Backend: `backend/`
- Frontend: `frontend/`
- Shared API types: `packages/api/`
- Feature docs: `specs/001-gateway-jwt-auth/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, config surface, and constitution alignment for JWT auth

- [ ] T001 Add JWT/JWKS dependency (`github.com/lestrrat-go/jwx` per research.md) to `backend/go.mod` / `backend/go.sum`
- [ ] T002 [P] Add auth JWT config fields and env parsing (`AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, `AUTH_JWT_JWKS_URL`, alg allowlist, optional clock skew, non-prod `AUTH_DEV_BYPASS`) in `backend/internal/config/config.go` and document names in `backend/.env.example` and `backend/docs/cursor-secrets.md`
- [ ] T003 [P] Confirm constitution Identity text matches gateway JWT + no app-admin + no ProcessManager auth (already 1.1.1); sync any leftover agent-guide wording if still stale

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema + verifier + middleware skeleton that all stories share

**⚠️ CRITICAL**: No user story work begins until this phase completes

- [ ] T004 Create PostgreSQL migration evolving `user_identities` with `issuer text not null`, `subject text not null`, `sign_in_method text not null` CHECK/allowlist including `google` (and reserved `apple`/`email`), `UNIQUE (issuer, subject)`, preserve `user_id` FK and existing `users`/learning tables — add `backend/db/migrations/000029_platform_identity_bindings.up.sql` and `.down.sql` (adjust number if next migration differs)
- [ ] T005 [P] Implement JWKS-cached access-token verifier (sig, alg allowlist reject `none`, exact `iss`, `aud` contains project client id, `exp`/`nbf` skew, require `sub`) in `backend/internal/auth/jwt_verifier.go`
- [ ] T006 [P] Add unit tests for verifier matrix helpers/fixtures (valid token, wrong aud, wrong iss, bad sig, expired, disallowed alg) in `backend/internal/auth/jwt_verifier_test.go`
- [ ] T007 Implement `EnsurePlatformUser` resolving/creating local user by `(issuer, subject)`, writing `sign_in_method` (live `google` only), treating email as informational only — no admin from registration; stop same-email auto-link as primary continuity — in `backend/internal/auth/platform_user.go` (replace/adapt `backend/internal/auth/central_user.go`)
- [ ] T008 Wire config + verifier into API bootstrap in `backend/cmd/api/main.go` (require JWT config in production; fail closed if JWKS URL/issuer/audience missing)
- [ ] T009 Replace `authMiddleware` to require Bearer JWT, verify via T005, call `EnsurePlatformUser`, ignore spoofed `X-User-*` until after verify (optional consistency check) in `backend/internal/http/auth_middleware.go`; stop production reliance on `CentralClient.ValidateSession` / cookie-session

**Checkpoint**: Foundation ready — JWT verify + identity schema usable by all stories

---

## Phase 3: User Story 1 — Ordinary learner access (Priority: P1) 🎯 MVP

**Goal**: Valid project JWT → ordinary local user → own learning/profile capabilities only; no admin from first sign-in

**Independent Test**: Valid JWT for new `(iss, sub)` gets 200 on `/api/auth/me` with ordinary profile; undeclared/admin ops denied; own learning routes work for that user only

### Tests for User Story 1

- [ ] T010 [P] [US1] Add middleware/handler tests: valid JWT → `/api/auth/me` ordinary user in `backend/internal/http/auth_middleware_test.go` and/or `backend/internal/http/auth_handler_test.go`
- [ ] T011 [P] [US1] Add authorization tests denying undeclared operations for ordinary user in `backend/internal/http/auth_handler_test.go`

### Implementation for User Story 1

- [ ] T012 [US1] Declare ordinary capability set per `specs/001-gateway-jwt-auth/contracts/ordinary-role.md` in `backend/internal/auth/ordinary_role.go` and enforce fail-closed if declaration empty
- [ ] T013 [US1] Ensure protected routes use JWT middleware and resolve `users.id` for own-data scoping (learning/decks/profile) via existing handlers under `backend/internal/http/` — confirm no path trusts central-auth session
- [ ] T014 [US1] Update `GET /api/auth/me` / linked-providers responses for platform identity metadata (`issuer`, `subject`, `sign_in_method`) in `backend/internal/http/auth_handler.go` and align DTOs in `packages/api/src/auth.ts` / `packages/api/src/types.ts`
- [ ] T015 [US1] Update frontend auth client to send `Authorization: Bearer <project_access_jwt>` only (no central-auth cookie validate assumptions) in `frontend/src/api/auth.ts` and adjust launch/token parsing in `frontend/src/utils/authLaunch.ts` for platform-delivered tokens

**Checkpoint**: US1 independently testable — ordinary JWT access works end-to-end on API (+ client Bearer)

---

## Phase 4: User Story 2 — Reject forged / invalid credentials (Priority: P1)

**Goal**: Fail closed on missing Bearer, spoofed headers, wrong aud/iss, bad sig, expired, ID-token substitute

**Independent Test**: Every reject case in `contracts/jwt-verification.md` returns 401/403 with no business side effects

### Tests for User Story 2

- [ ] T016 [P] [US2] Expand HTTP-level reject matrix tests (missing Bearer, spoofed `X-User-Subject` only, wrong aud, wrong iss, bad sig, expired, ID-token substitute) in `backend/internal/http/auth_middleware_test.go`
- [ ] T017 [P] [US2] Assert JWKS unreachable / unknown `kid` without successful refresh fails closed in `backend/internal/auth/jwt_verifier_test.go`

### Implementation for User Story 2

- [ ] T018 [US2] Harden middleware to strip/ignore client identity headers before verify and never authorize from headers alone in `backend/internal/http/auth_middleware.go`
- [ ] T019 [US2] Implement ID-token / wrong-credential-type rejection heuristics documented in verifier in `backend/internal/auth/jwt_verifier.go`
- [ ] T020 [US2] Ensure fail-closed behavior when JWKS fetch fails (no business handler) and document expected status in `specs/001-gateway-jwt-auth/contracts/jwt-verification.md` if clarifying

**Checkpoint**: US2 independently testable — attack/misconfig matrix green

---

## Phase 5: User Story 3 — Preserve accounts via operator migration (Priority: P1)

**Goal**: Keep existing `users` + learning data; operator binds Keycloak `(issuer, subject)` with `sign_in_method=google`; hard cutover rejects central-auth credentials

**Independent Test**: Migrated user JWT opens same `users.id` with prior learning counts; unmigrated new Keycloak user gets new ordinary account; legacy central-auth token rejected

### Tests for User Story 3

- [ ] T021 [P] [US3] Test identity bind lookup: existing `(issuer, subject)` → same `user_id` and learning ownership in `backend/internal/auth/platform_user_test.go`
- [ ] T022 [P] [US3] Test first-time unknown `(issuer, subject)` creates new ordinary user (not admin) in `backend/internal/auth/platform_user_test.go`
- [ ] T023 [P] [US3] Test production path rejects legacy `mock-dev-token` / central-auth session credentials when JWT mode enabled in `backend/internal/http/auth_middleware_test.go`

### Implementation for User Story 3

- [ ] T024 [US3] Add operator migration script/SQL template binding local `users.id` → `(issuer, subject, sign_in_method=google)` without wiping tables in `scripts/migrate-platform-identities.sql` (or `scripts/migrate-platform-identities.sh`) matching `specs/001-gateway-jwt-auth/contracts/operator-migration.md`
- [ ] T025 [US3] Document operator runbook steps (inputs, acceptance checks, no secrets in git) in `backend/docs/platform-identity-migration.md`
- [ ] T026 [US3] Remove/disable production central-auth validate/refresh/cookie paths from `backend/internal/auth/central_client.go` usage in `backend/cmd/api/main.go` and `backend/internal/http/auth_handler.go` (deprecate `POST /api/auth/refresh` per `contracts/auth-api-surface.md` — 410 or remove)
- [ ] T027 [US3] Gate any remaining `mock-dev-token` / `AUTH_DEV_BYPASS` to non-production only in `backend/internal/auth/` and `backend/internal/config/`

**Checkpoint**: US3 independently testable — continuity + hard cutover

---

## Phase 6: User Story 4 — Remove app-admin + ProcessManager auth remnants (Priority: P1)

**Goal**: No application-admin role; purge ProcessManager auth remnants and legacy session-auth docs/code from Project PN

**Independent Test**: No app-admin authz path; docs/code do not treat ProcessManager as auth authority; JWT-only production path

### Tests for User Story 4

- [ ] T028 [P] [US4] Add/adjust tests so product authz never depends on `is_admin` / admin bindings in `backend/internal/auth/` and `backend/internal/http/` tests
- [ ] T029 [P] [US4] Explicit cross-user denial test: identity A JWT cannot read identity B learning resource in `backend/internal/http/words_handler_test.go` (or dedicated authz test)

### Implementation for User Story 4

- [ ] T030 [US4] Remove app-admin product authorization (`is_admin` usage for access control, admin-gated APIs/UI) from `backend/internal/auth/`, `backend/internal/http/`, and related frontend surfaces; migrate DB column away or leave unused with docs stating ignored
- [ ] T031 [US4] Remove ProcessManager auth remnants from Project PN auth docs and agent guides (`backend/docs/oracle-deploy-runbook.md`, `deploy/deploy-exception-runbook.md`, `backend/docs/cursor-secrets.md` auth sections, `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`) — production auth = platform Keycloak JWT only
- [ ] T032 [US4] Delete or gut unused central-auth session client paths and ProcessManager-oriented auth config from `backend/internal/auth/central_client.go`, `backend/cmd/api/main.go`, and `backend/.env.example` after JWT path is wired

**Checkpoint**: US4 independently testable — cleanup complete

---

## Phase 7: User Story 5 — Multi-client verify + key rotation (Priority: P2)

**Goal**: Same Bearer verify path for web/native/desktop/extension; JWKS rotation works; no project-owned login bypass; platform owns token acquisition/SSO

**Independent Test**: Valid JWT accepted regardless of client type in tests; new `kid` accepted after JWKS refresh; no PN Google OIDC login path reintroduced

### Tests for User Story 5

- [ ] T033 [P] [US5] Test JWKS key rotation / unknown `kid` refresh success path in `backend/internal/auth/jwt_verifier_test.go`
- [ ] T034 [P] [US5] Confirm shared API client attaches Bearer consistently in `packages/api` / `frontend/src/api` tests (`frontend/src/api/auth.ts` related tests)

### Implementation for User Story 5

- [ ] T035 [US5] Ensure JWKS cache refreshes on unknown `kid` then re-verifies in `backend/internal/auth/jwt_verifier.go`
- [ ] T036 [US5] Update client env examples to platform auth/API URLs (not central-auth/ProcessManager login as production IdP) in `frontend/.env.example` and `packages/api` docs/comments; remove project-owned OIDC/Google login bypass if any remain under `frontend/src/features/auth/`
- [ ] T037 [US5] Note in `specs/001-gateway-jwt-auth/quickstart.md` that SSO lifetime/silent refresh is platform-owned; PN validates `exp` only

**Checkpoint**: US5 independently testable — multi-client Bearer + rotation

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Docs, cleanup, full-suite validation

- [ ] T038 [P] Update auth docs to gateway JWT model in `backend/docs/backend-overview.md`, `backend/docs/backend-flows.md`, and retire obsolete central-auth/ProcessManager session instructions where they conflict
- [ ] T039 [P] Align `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` auth routing with platform Keycloak JWT (no ProcessManager auth, no central-auth session as production path)
- [ ] T040 Remove dead central-auth-only test doubles that contradict JWT mode from `backend/internal/http/helper_test.go` / related tests after migration
- [ ] T041 Run serial backend suite `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...` and frontend `npm test -w frontend` / `npm run typecheck -w frontend` / `npm run typecheck -w packages/api`
- [ ] T042 Execute validation checklist from `specs/001-gateway-jwt-auth/quickstart.md` and record pass/fail in operator notes (no live tokens committed)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** → no deps
- **Phase 2 Foundational** → after Setup; **blocks all stories**
- **US1 (Phase 3)** → after Foundational — MVP
- **US2 (Phase 4)** → after Foundational; ideally after verifier exists (T005–T006); can parallelize with US1 once middleware wired
- **US3 (Phase 5)** → after Foundational + identity schema (T004/T007); benefits from US1 middleware
- **US4 (Phase 6)** → after JWT path exists (US1/US3); cleanup of admin + ProcessManager remnants
- **US5 (Phase 7)** → after verifier (T005) + US1 client Bearer path
- **Polish** → after desired stories complete

### User Story Dependencies

- **US1**: Foundation only
- **US2**: Foundation (verifier + middleware)
- **US3**: Foundation identity model; cutover after JWT path works
- **US4**: After JWT ordinary path; removes app-admin + ProcessManager auth remnants
- **US5**: Needs verifier + client Bearer from US1

### Parallel Opportunities

- T002 ∥ T003 after T001 started
- T005 ∥ T006 during foundational (tests can lead)
- T010 ∥ T011 (US1 tests)
- T016 ∥ T017 (US2 tests)
- T021 ∥ T022 ∥ T023 (US3 tests)
- T028 ∥ T029 (US4 tests)
- T038 ∥ T039 (docs polish)

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
Task: "T010 valid JWT → /api/auth/me ordinary in auth_middleware_test.go / auth_handler_test.go"
Task: "T011 ordinary denied undeclared ops in auth_handler_test.go"

# Then implementation sequence:
Task: "T012 ordinary_role.go"
Task: "T013 protected routes JWT-only"
Task: "T014 me/linked-providers + packages/api DTOs"
Task: "T015 frontend Bearer client"
```

---

## Parallel Example: User Story 2

```bash
Task: "T016 HTTP reject matrix in auth_middleware_test.go"
Task: "T017 JWKS failure / kid tests in jwt_verifier_test.go"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 Setup  
2. Phase 2 Foundational  
3. Phase 3 US1 (ordinary JWT access)  
4. **STOP & VALIDATE** with quickstart §1–2  
5. Then US2 harden rejects → US3 migration/cutover before production  

### Incremental Delivery

1. Setup + Foundational  
2. US1 MVP demo  
3. US2 security matrix  
4. US3 operator migration + hard cutover  
5. US4 remove app-admin + ProcessManager auth remnants  
6. US5 multi-client + JWKS rotation polish  
7. Phase 8 docs + full test suites  

### Suggested MVP scope

**US1 only** (ordinary verified JWT → local user → own capabilities), on top of Phase 1–2. Do not production-cutover until **US2 + US3 + US4** cleanup.

---

## Notes

- SSO session length / silent refresh → platform; not tasked here  
- Live `sign_in_method` = `google` only; schema may reserve `apple`/`email`  
- All tasks use checklist format with IDs and paths  
- Prefer serial Go tests (`-p 1`) for DB suites  

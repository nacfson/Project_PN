# Tasks: Gateway JWT Auth Verification & Platform Identity Migration

**Input**: Design documents from `/specs/001-gateway-jwt-auth/` (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md) and Platform Identity Migration Runbook (`backend/docs/platform-identity-migration.md`).

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md.

**Tests**: Included — spec FR-015 and contracts require automated accept-reject matrices, ordinary capability enforcement, and cross-user denial tests.

**Out of scope for these tasks**: Platform SSO idle/max lifetime, Keycloak Google broker UI, Traefik ForwardAuth implementation (platform-owned in `nacfson_pipeline`). Project PN only verifies in-cluster project-scoped JWTs and resolves local accounts.

**Organization**: Grouped strictly by user story for independent implementation and testing.

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **Checkbox**: `- [ ]` markdown checkbox
- **[TaskID]**: Sequential ID (`T001`, `T002`, `T003`, ...)
- **[P]**: Parallelizable task (different files, no incomplete dependencies)
- **[Story]**: `[US1]`, `[US2]`, `[US3]`, `[US4]`, `[US5]` mapping to spec.md user stories (User Story phases only)
- Exact file paths in every task description

## Path Conventions

- Backend: `backend/`
- Frontend: `frontend/`
- Shared API types: `packages/api/`
- Deployment boundary manifests: `deploy/projects/pn/`
- Feature docs: `specs/001-gateway-jwt-auth/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, configuration surface, and repository alignment for gateway JWT auth.

- [X] T001 Add JWT/JWKS dependency (`github.com/lestrrat-go/jwx/v3` or v2 per research.md) to `backend/go.mod` and `backend/go.sum`
- [X] T002 [P] Add auth JWT configuration fields and env parsing (`AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, `AUTH_JWT_JWKS_URL`, allowed `alg` list defaulting to `["RS256"]`, clock skew duration, non-prod `AUTH_DEV_BYPASS`) in `backend/internal/config/config.go`, and document configuration variables in `backend/.env.example` and `backend/docs/cursor-secrets.md`
- [X] T003 [P] Verify constitution Identity text (Section 1.1.1) and clean up obsolete ProcessManager / session environment variables in `backend/.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database schema, JWT verifier skeleton, and middleware infrastructure that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Create PostgreSQL migration evolving `user_identities` with verbatim constraints: `issuer text not null` ("Exact Keycloak realm issuer URL (`iss`)"), `subject text not null` ("Keycloak `sub`"), `sign_in_method text not null` with CHECK `(sign_in_method IN ('google', 'apple', 'email'))` ("Live: `google` only; reserved: `apple`, `email`"), `email_at_provider text nullable`, `UNIQUE (issuer, subject)`, `user_id uuid not null references users(id) on delete cascade`, create index on `user_id`, and preserving `users` and learning tables without truncate — add `backend/db/migrations/000029_platform_identity_bindings.up.sql` and `backend/db/migrations/000029_platform_identity_bindings.down.sql`
- [X] T005 [P] Implement in-cluster JWKS-cached access-token verifier validating signature, `alg` allowlist (reject `none`), exact `iss` match, `aud` contains project client id (`project-pn`), `exp`/`nbf` skew, non-empty `sub`, and access token marker in `backend/internal/auth/jwt_verifier.go`
- [X] T006 [P] Implement unit tests for JWKS verifier accept/reject matrix (valid token, wrong aud, wrong iss, bad signature, expired token, disallowed alg) in `backend/internal/auth/jwt_verifier_test.go`
- [X] T007 Implement `EnsurePlatformUser` resolving or creating local user by `(issuer, subject)` with verbatim rules: `UNIQUE (issuer, subject)`, `sign_in_method = 'google'`, email as informational snapshot only, ordinary privileges without admin grant, no same-email auto-link as primary continuity — in `backend/internal/auth/platform_user.go`
- [X] T008 Wire `AUTH_JWT_*` configuration and JWT verifier initialization in API bootstrap in `backend/cmd/api/main.go` (require JWT config in production, fail closed if unconfigured)
- [X] T009 Rewrite `authMiddleware` to require Bearer JWT, verify via `jwt_verifier.go`, resolve identity via `EnsurePlatformUser`, discard unverified `X-User-*` headers until verification passes, and inject user into request context in `backend/internal/http/auth_middleware.go`

**Checkpoint**: Foundation ready — JWT verification, identity schema, and auth middleware usable by all user stories.

---

## Phase 3: User Story 1 — Signed-in learner uses the app with ordinary access (Priority: P1) 🎯 MVP

**Goal**: A returning or new learner presenting a valid project access token (`aud = project-pn`) is recognized via verified `(issuer, subject)` binding and granted ordinary learning capabilities (study, add words, review, manage own decks and settings) with no application-administrator role.

**Independent Test**: Present a valid project access credential for a new or known identity; confirm `/api/auth/me` returns 200 with ordinary profile; verify the learner reaches the ordinary experience and cannot access other users' private data or undeclared operations.

### Tests for User Story 1

- [X] T010 [P] [US1] Add middleware and handler tests verifying valid project JWT grants access to `GET /api/auth/me` as ordinary user in `backend/internal/http/auth_middleware_test.go` and `backend/internal/http/auth_handler_test.go`
- [X] T011 [P] [US1] Add authorization tests verifying that ordinary users are denied undeclared operations in `backend/internal/http/auth_handler_test.go`

### Implementation for User Story 1

- [X] T012 [US1] Declare ordinary capability set (`learning.read_own`, `learning.write_own`, `decks.manage_own`, `profile.read_own`, `profile.write_own`, `merge.participate`) per `specs/001-gateway-jwt-auth/contracts/ordinary-role.md` and enforce fail-closed check if declaration is empty in `backend/internal/auth/ordinary_role.go`
- [X] T013 [US1] Ensure protected learning routes (`/api/words/*`, `/api/decks/*`, `/api/settings/*`) use JWT middleware and resolve `users.id` for own-data scoping with no session trust in `backend/internal/http/words_handler.go`, `backend/internal/http/decks_handler.go`, and `backend/internal/http/settings_handler.go`
- [X] T014 [US1] Update `GET /api/auth/me` and `GET /api/auth/linked-providers` handlers to return platform identity metadata (`issuer`, `subject`, `sign_in_method`) without admin attributes in `backend/internal/http/auth_handler.go` and align DTOs in `packages/api/src/auth.ts` and `packages/api/src/types.ts`
- [X] T015 [US1] Update frontend auth client to send `Authorization: Bearer <project_access_jwt>` only (no central-auth cookie validate assumptions) in `frontend/src/api/auth.ts` and adjust launch/token parsing in `frontend/src/utils/authLaunch.ts`

**Checkpoint**: User Story 1 fully functional and testable independently — ordinary JWT access works end-to-end on API and frontend client.

---

## Phase 4: User Story 2 — Impersonation, forged identity, and unauthenticated access are rejected fail-closed (Priority: P1)

**Goal**: Unauthenticated visitors, attackers, or misconfigured clients presenting missing credentials, wrong audience, wrong issuer, bad signature, expired credentials, substituted ID tokens, or spoofed identity headers are rejected fail-closed (401/403) with no business logic execution; frontend startup strictly fails closed on errors.

**Independent Test**: Send requests with missing credentials, wrong audience (`aud != project-pn`), wrong issuer (`iss != https://auth.nacfson.cloud/realms/platform`), bad signature, expired credential, substituted ID-style credential, or spoofed headers alone; all return 401/403. Verify frontend `App.tsx` on connection/auth errors transitions to `unauthenticated` with an error banner and never bypasses into main tabs.

### Tests for User Story 2

- [X] T016 [P] [US2] Add HTTP reject matrix tests (missing Bearer, spoofed `X-User-Subject`/`X-User-Issuer` headers without Bearer, wrong `aud`, wrong `iss`, bad signature, expired token, ID token substituted) in `backend/internal/http/auth_middleware_test.go`
- [X] T017 [P] [US2] Add unit test asserting fail-closed 401/403 behavior when JWKS is unreachable or unknown `kid` cannot be refreshed in `backend/internal/auth/jwt_verifier_test.go`
- [X] T018 [P] [US2] Add frontend gate unit test verifying `App.tsx` sets `unauthenticated` with error banner on network error / 500 / offline backend instead of defaulting to `authenticated` in `frontend/App.test.tsx`

### Implementation for User Story 2

- [X] T019 [US2] Harden `authMiddleware` to ignore and strip client-supplied `X-User-Subject` / `X-User-Issuer` before verification and never authorize from headers alone in `backend/internal/http/auth_middleware.go`
- [X] T020 [US2] Implement rejection for OIDC ID tokens, Google access tokens, and non-project audience tokens (`aud != project-pn`) in `backend/internal/auth/jwt_verifier.go`
- [X] T021 [US2] Ensure fail-closed rejection (401 Unauthorized) when JWKS fetch or refresh fails in `backend/internal/auth/jwt_verifier.go`
- [X] T022 [US2] Fix fail-open gate bug in `checkAuth` catch block to strictly set `setAuthState('unauthenticated')` and show connection error banner instead of defaulting to `authenticated` in `frontend/App.tsx`

**Checkpoint**: User Story 2 independently functional — attack/misconfiguration reject matrix is green and frontend fails closed.

---

## Phase 5: User Story 3 — Existing accounts preserve learning progress via operator migration (Priority: P1)

**Goal**: Verification moves entirely to Keycloak project JWTs while preserving existing `users` rows, decks, words, FSRS states, and review history; operator binds each existing local account to its Keycloak `(issuer, subject)` before cutover; hard cutover rejects legacy central-auth credentials.

**Independent Test**: Take an existing local account with learning data; after operator binding, a Keycloak JWT for that identity opens the same `users.id` with prior learning progress; an unmigrated new Keycloak user gets a new ordinary account; legacy central-auth session tokens are rejected.

### Tests for User Story 3

- [X] T023 [P] [US3] Add unit tests verifying `EnsurePlatformUser` resolves existing `(issuer, subject)` binding to same `user_id` and learning ownership in `backend/internal/auth/platform_user_test.go`
- [X] T024 [P] [US3] Add unit test verifying unknown `(issuer, subject)` creates a new ordinary local user without admin role in `backend/internal/auth/platform_user_test.go`
- [X] T025 [P] [US3] Add integration test verifying production API rejects legacy `mock-dev-token` and central-auth session tokens when JWT mode is active in `backend/internal/http/auth_middleware_test.go`

### Implementation for User Story 3

- [X] T026 [US3] Create operator migration SQL script template binding local `users.id` to verbatim columns: `issuer = 'https://auth.nacfson.cloud/realms/platform'`, `subject = :keycloak_sub`, `sign_in_method = 'google'`, `UNIQUE (issuer, subject)` without truncating or wiping `users` or learning tables in `scripts/migrate-platform-identities.sql` per `specs/001-gateway-jwt-auth/contracts/operator-migration.md`
- [X] T027 [US3] Deprecate/disable legacy central-auth session validation, cookie sessions, and refresh proxy (`POST /api/auth/refresh` returns 410 Gone or is removed) in `backend/internal/http/auth_handler.go` and `backend/internal/auth/central_client.go`
- [X] T028 [US3] Restrict `mock-dev-token` / dev bypass strictly to non-production environments gated by `AUTH_DEV_BYPASS=true` in `backend/internal/auth/auth_dev.go` and `backend/cmd/api/main.go`

**Checkpoint**: User Story 3 independently testable — account continuity preserved, operator script ready, hard cutover enforced.

---

## Phase 6: User Story 4 — Remove app-admin and ProcessManager / legacy auth remnants (Priority: P1)

**Goal**: Eliminate application-admin authorization and purge all ProcessManager / `auth.nacfson.cloud` client redirects and legacy auth references from code, build scripts, and docs.

**Independent Test**: Repo search shows no ProcessManager auth path, no `auth.nacfson.cloud` client redirects, no app-admin authorization path; build scripts pass without `EXPO_PUBLIC_CENTRAL_AUTH_URL`.

### Tests for User Story 4

- [X] T029 [P] [US4] Add tests verifying that `is_admin` or admin privileges have no effect on product authorization in `backend/internal/auth/platform_user_test.go` and `backend/internal/http/auth_handler_test.go`
- [X] T030 [P] [US4] Add cross-user isolation test verifying identity A cannot access identity B's private learning resources in `backend/internal/http/words_handler_test.go`

### Implementation for User Story 4

- [X] T031 [US4] Remove app-admin role checks and authorization gates from `backend/internal/http/` and `backend/internal/auth/`
- [X] T032 [US4] Remove `auth.nacfson.cloud/login` browser redirect and route browser web sign-in to platform `/oauth/start?return=<origin>/` in `frontend/src/screens/CentralAuthScreen.tsx`
- [X] T033 [US4] Remove `EXPO_PUBLIC_CENTRAL_AUTH_URL` and `auth.nacfson.cloud` fallbacks from `frontend/src/config.ts` and `frontend/.env.example`
- [X] T034 [US4] Remove hardcoded `EXPO_PUBLIC_CENTRAL_AUTH_URL=https://auth.nacfson.cloud` and its assertion gate from `scripts/push-ghcr.sh` and `.github/workflows/publish-ghcr-images.yml`
- [X] T035 [US4] Purge ProcessManager auth references and central-auth session instructions from `backend/docs/oracle-deploy-runbook.md`, `deploy/deploy-exception-runbook.md`, and `backend/docs/cursor-secrets.md`
- [X] T036 [US4] Remove or deprecate unused legacy session validation functions from `backend/internal/auth/central_client.go`

**Checkpoint**: User Story 4 independently testable — clean codebase without admin roles or legacy auth paths.

---

## Phase 7: User Story 5 — All client platforms and operational continuity (Priority: P2)

**Goal**: Web, native, desktop, and extension clients all present the same kind of project access credential; backend pod connects to Keycloak JWKS via cluster DNS under NetworkPolicy; JWKS signing keys rotate without breaking the verify model.

**Independent Test**: Valid project JWT accepted regardless of client type in test harnesses; new `kid` accepted after JWKS refresh; backend pod connects to Keycloak JWKS via cluster DNS under NetworkPolicy.

### Tests for User Story 5

- [X] T037 [P] [US5] Add unit test for JWKS key rotation verifying unknown `kid` triggers cache refresh and succeeds with new key in `backend/internal/auth/jwt_verifier_test.go`
- [X] T038 [P] [US5] Add integration assertion verifying shared API client in `packages/api` consistently attaches Bearer token across web and non-web consumers in `packages/api/src/auth.test.ts`

### Implementation for User Story 5

- [X] T039 [US5] Implement cache refresh on unknown `kid` in `backend/internal/auth/jwt_verifier.go`
- [X] T040 [US5] Add NetworkPolicy egress rule allowing backend pod egress to `identity` namespace / Keycloak port 8080 in `deploy/projects/pn/boundary/network-policy.yaml`
- [X] T041 [US5] Remove any project-owned OIDC or Google login bypass code from `frontend/src/features/auth/`

**Checkpoint**: User Story 5 independently testable — multi-client Bearer, JWKS rotation, and NetworkPolicy egress operational.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates, cleanup of dead code and test doubles, and full test suite verification.

- [X] T042 [P] Update architecture and flow documentation to gateway JWT model in `backend/docs/backend-overview.md` and `backend/docs/backend-flows.md`
- [X] T043 [P] Align task routing and operational guides in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` to platform Keycloak JWT verification
- [X] T044 Remove obsolete central-auth mock fixtures and test doubles in `backend/internal/http/helper_test.go`
- [X] T045 Run serial backend test suite `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`
- [X] T046 Run frontend tests and workspace typechecks: `npm test -w frontend`, `npm run typecheck -w frontend`, and `npm run typecheck -w packages/api`
- [X] T047 Execute acceptance checklist from `specs/001-gateway-jwt-auth/quickstart.md` and update `agy_plan/html/001-gateway-jwt-auth.html`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — **BLOCKS all user stories**.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
  - US1 (Phase 3) is the primary MVP increment.
  - US2 (Phase 4) can proceed in parallel with or after US1.
  - US3 (Phase 5) depends on the foundational identity schema and benefits from US1 middleware.
  - US4 (Phase 6) depends on US1/US3 to ensure the JWT path works before cleaning up legacy paths.
  - US5 (Phase 7) depends on US1/US2 verifier and client Bearer paths.
- **Polish (Phase 8)**: Depends on all user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories.
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) — Rejection matrix builds on verifier and middleware from Phase 2; frontend fail-closed fix is independent of backend logic.
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) — Operator migration builds on identity table schema from Phase 2; hard cutover requires US1/US2 to be in place.
- **User Story 4 (P1)**: Can start after US1 is functional — Removes app-admin and legacy auth remnants safely.
- **User Story 5 (P2)**: Can start after US1/US2 — Expands JWKS rotation and NetworkPolicy for multi-client operational continuity.

### Within Each User Story

- Tests (where included) are written FIRST and must fail before implementation.
- Models and schema before services.
- Verifiers and services before endpoints and handlers.
- Endpoints before client/frontend integrations.
- Story complete and validated before moving to next priority.

### Parallel Opportunities

- Phase 1: T002 and T003 can run in parallel after T001 is started.
- Phase 2: T005, T006 can run in parallel once dependencies are ready; T004 is independent of T005.
- Phase 3 (US1): Tests T010 and T011 can run in parallel.
- Phase 4 (US2): Tests T016, T017, and T018 can all run in parallel across backend and frontend.
- Phase 5 (US3): Tests T023, T024, and T025 can run in parallel.
- Phase 6 (US4): Tests T029 and T030 can run in parallel; implementation tasks T032, T033, T034, T035 touch different files and can run in parallel.
- Phase 7 (US5): Tests T037 and T038 can run in parallel.
- Phase 8 (Polish): T042 and T043 can run in parallel.

---

## Parallel Execution Examples

### User Story 1 (Ordinary Access)
```bash
# Launch tests together:
Task: "T010 [P] [US1] Add middleware/handler tests for valid project JWT in backend/internal/http/auth_middleware_test.go"
Task: "T011 [P] [US1] Add authorization tests denying undeclared ops in backend/internal/http/auth_handler_test.go"

# Then implementation sequence:
Task: "T012 [US1] Declare ordinary capability set in backend/internal/auth/ordinary_role.go"
Task: "T013 [US1] Ensure protected routes use JWT middleware in backend/internal/http/words_handler.go"
Task: "T014 [US1] Update me/linked-providers in backend/internal/http/auth_handler.go and packages/api/src/auth.ts"
Task: "T015 [US1] Update frontend auth client Bearer in frontend/src/api/auth.ts"
```

### User Story 2 (Reject Matrix & Gate Fix)
```bash
# Launch tests together across backend and frontend:
Task: "T016 [P] [US2] Add HTTP reject matrix tests in backend/internal/http/auth_middleware_test.go"
Task: "T017 [P] [US2] Add JWKS unreachable / unknown kid tests in backend/internal/auth/jwt_verifier_test.go"
Task: "T018 [P] [US2] Add frontend gate unit test in frontend/App.test.tsx"

# Implementation in parallel:
Task: "T020 [US2] Implement rejection for ID tokens and foreign audiences in backend/internal/auth/jwt_verifier.go"
Task: "T022 [US2] Fix fail-open gate bug in checkAuth catch block in frontend/App.tsx"
```

### User Story 4 (Remnants Cleanup)
```bash
# Launch independent cleanup tasks in parallel:
Task: "T032 [US4] Remove auth.nacfson.cloud redirects in frontend/src/screens/CentralAuthScreen.tsx"
Task: "T033 [US4] Remove EXPO_PUBLIC_CENTRAL_AUTH_URL in frontend/src/config.ts"
Task: "T034 [US4] Remove build assertions in scripts/push-ghcr.sh and .github/workflows/publish-ghcr-images.yml"
Task: "T035 [US4] Purge ProcessManager auth references in backend/docs/oracle-deploy-runbook.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T009) — **CRITICAL**: blocks all stories
3. Complete Phase 3: User Story 1 (T010–T015)
4. **STOP and VALIDATE**: Verify valid project JWT → `/api/auth/me` returns 200 with ordinary role; own learning items accessible; undeclared ops denied
5. Ready for local/dev demonstration of verified platform identity

### Incremental Delivery

1. Setup + Foundational → Database ready, verifier skeleton operational
2. User Story 1 → Ordinary access works end-to-end (MVP)
3. User Story 2 → Reject matrix complete, frontend fail-closed gate locked
4. User Story 3 → Existing account data preserved, operator migration ready, hard cutover enforced
5. User Story 4 → App-admin removed, ProcessManager remnants and `auth.nacfson.cloud` client redirects purged
6. User Story 5 → Multi-client Bearer, JWKS rotation, NetworkPolicy egress validated
7. Phase 8 Polish → Serial backend tests passing, frontend typechecks passing, docs aligned

---

## Notes

- All tasks strictly follow checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
- Exact constraints from `data-model.md` are quoted verbatim in T004, T007, and T026
- Backend tests must run serially: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`
- Frontend Add-tab product lock invariant (`activeTab === 'manual'`) must not be disturbed

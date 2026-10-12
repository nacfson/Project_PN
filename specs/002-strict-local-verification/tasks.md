# Tasks: Strict Verification System & Local Stack Connectivity Fix

**Input**: Design documents from `/specs/002-strict-local-verification/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Spec requires verification tooling itself (FR-004, FR-009), so the contract E2E test is an implementation task (US2). No separate TDD suite was requested.

**Organization**: Grouped by user story so each can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1-US4 maps to spec.md user stories

## Phase 1: Setup

- [X] T001 Confirm baseline by running `npm run lint:imports`, `npm test -w frontend`, `npm test -w packages/api` from repo root and record any existing failures in `specs/002-strict-local-verification/research.md` under "Baseline"
- [X] T002 [P] Create directory `.githooks/` at repo root (empty placeholder until US3)

---

## Phase 2: Foundational (blocks all user stories)

- [X] T003 Add `"typecheck": "tsc --noEmit"` script to `frontend/package.json` and make `npm run typecheck -w frontend` pass (constitution V requires it; currently missing)
- [X] T004 [P] Verify `npm run typecheck -w packages/api` passes; fix any type errors in `packages/api/src/`
- [X] T005 Add root scripts `"verify": "scripts/verify-local.sh"` and `"verify:full": "scripts/verify-local.sh --full"` to `package.json` (scripts file created in US1)

**Checkpoint**: Typecheck scripts exist for every workspace named in the gates.

---

## Phase 3: User Story 1 - One-command local readiness verification (P1) MVP

**Goal**: One command that fails loudly and specifically when any part of the local stack is unhealthy.

**Independent Test**: Quickstart scenarios 1, 2, 3. With stack stopped it fails per component; healthy stack passes.

- [X] T006 [US1] Create `scripts/verify-local.sh` skeleton: `set -u`, per-check result helper printing `[PASS]/[FAIL]` with detail and remediation hint, summary line `RESULT: PASS|FAIL`, exit codes 0/1/2 per `contracts/verify-local-cli.md`
- [X] T007 [US1] In `scripts/verify-local.sh` implement check `env-files` (`backend/.env`, `frontend/.env` exist; hint to copy from `.env.example`)
- [X] T008 [US1] In `scripts/verify-local.sh` implement check `db-reachable` (TCP connect to host/port parsed from `DATABASE_URL` in `backend/.env`, default `localhost:5433`; hint: `docker compose -f backend/compose.yaml --env-file backend/.env up -d`)
- [X] T009 [US1] In `scripts/verify-local.sh` implement checks `backend-alive` (`GET /healthz` = 200) and `backend-ready` (`GET /readyz` = 200), reported separately; mark `backend-ready` as dependent-skipped output only when alive fails (never counts as a pass)
- [X] T010 [US1] In `scripts/verify-local.sh` implement check `client-up` (web client on port 8081 answers) and port-conflict detection (listener present but wrong health response reports conflict, not pass)
- [X] T011 [US1] In `scripts/verify-local.sh` implement check `client-to-backend`: read `EXPO_PUBLIC_API_BASE_URL` from `frontend/.env` (default `http://localhost:8080`), send authenticated request with `Authorization: Bearer mock-dev-token`; report 401/403 as an auth problem distinct from connectivity
- [X] T012 [US1] In `scripts/verify-local.sh` implement `--full` flag running `npm run lint:imports`, `npm run typecheck -w frontend`, `npm run typecheck -w packages/api`, `npm test -w frontend`, `npm test -w packages/api`, and `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`, each as its own reported check; no flag may skip or downgrade a failure (FR-002, FR-008)
- [X] T013 [US1] Make `scripts/verify-local.sh` executable (`chmod +x`), prerequisite check for `curl` (exit 2 if missing), and validate with quickstart scenarios 1-3 on the current (stopped) stack

**Checkpoint**: `npm run verify` is independently usable and reproduces the original incident as a clear FAIL.

---

## Phase 4: User Story 2 - Mandatory quality gates before merge (P1)

**Goal**: Constitution pre-merge checklist enforced in CI; failures block merge and publishing.

**Independent Test**: Quickstart scenario 6 with throwaway regression PRs.

- [X] T014 [US2] Create `packages/api/src/contract.e2e.test.ts` that, when `CONTRACT_E2E_BASE_URL` is set, calls the shared client wrappers in `packages/api/src/` (decks, learningItems, auth) against the real backend with token `mock-dev-token` and asserts the response fields the client types in `packages/api/src/types.ts` rely on (FR-009); it must FAIL (not skip) in the CI job when the variable is set but the backend is unreachable
- [X] T015 [P] [US2] Add npm script `test:contract` to `packages/api/package.json` running only the E2E test, and exclude it from the default `npm test -w packages/api` unless `CONTRACT_E2E_BASE_URL` is set (update `packages/api/jest.config.js` if needed)
- [X] T016 [US2] Create `.github/workflows/quality-gates.yml` triggered on `pull_request` and `push` to `main` and `workflow_dispatch`, with job `static` (`npm ci --legacy-peer-deps`, `npm run lint:imports`, `npm run typecheck -w frontend`, `npm run typecheck -w packages/api`)
- [X] T017 [US2] In `.github/workflows/quality-gates.yml` add job `frontend-tests` (`npm test -w frontend`, `npm test -w packages/api`) and job `add-tab-invariant` (`rg "useState<'passage' \| 'manual'>" frontend/src/navigation/AddScreen.tsx` must output `'manual'`, fail otherwise)
- [X] T018 [US2] In `.github/workflows/quality-gates.yml` add job `backend-tests` with a Postgres 16 service, `go run ./cmd/migrate up`, then `GOTOOLCHAIN=go1.26.0 go test -p 1 ./...` working in `backend/`
- [X] T019 [US2] In `.github/workflows/quality-gates.yml` add job `contract-e2e`: Postgres 16 service, migrate, start `go run ./cmd/api` in background, wait for `/readyz`, run `CONTRACT_E2E_BASE_URL=http://localhost:8080 npm run test:contract -w packages/api`
- [X] T020 [US2] Edit `.github/workflows/publish-ghcr-images.yml` so `publish-backend` and the frontend publish job `needs` all gate jobs (`static`, `frontend-tests`, `add-tab-invariant`, `backend-tests`, `contract-e2e`) in addition to `preflight-checks`; no `continue-on-error`, no skip inputs
- [X] T021 [US2] Ensure no gate has `continue-on-error`, override input, or conditional skip in `.github/workflows/quality-gates.yml` (FR-008); document in `specs/002-strict-local-verification/contracts/ci-quality-gates.md` the owner step: mark all gate jobs as required status checks on `main`

**Checkpoint**: A PR with a broken test, type, Add default, or contract field fails a required check and cannot publish.

---

## Phase 5: User Story 3 - Local pre-push enforcement (P2)

**Goal**: Fast checks block a push locally; no skip option provided.

**Independent Test**: Quickstart scenario 5.

- [X] T022 [US3] Create `.githooks/pre-push` (executable) running `npm run lint:imports`, `npm run typecheck -w frontend`, `npm run typecheck -w packages/api`, `npm test -w frontend`; exits non-zero on first failure with the failing check printed; no env var or flag that skips checks
- [X] T023 [US3] Add `"prepare": "git config core.hooksPath .githooks"` to root `package.json` so installing dependencies activates the hook
- [X] T024 [US3] Time the hook on a clean tree and confirm it completes within 2 minutes (SC-006); if over, trim to the fastest subset and record the measured time in `specs/002-strict-local-verification/quickstart.md`

**Checkpoint**: Pushing a deliberate type error is blocked; CI remains the authoritative backstop.

---

## Phase 6: User Story 4 - Fix: client fails loudly when backend is unreachable (P2)

**Goal**: Clear dev-time message and reproducible startup docs.

**Independent Test**: Quickstart scenarios 7 and 8.

- [X] T025 [US4] In `frontend/src/api/client.ts` (via the `configureApi` layer of `@project-pn/api` in `packages/api/src/client.ts`) add a network-error hook that, only when `__DEV__` is true, reports a message naming the attempted base URL and suggesting `npm run verify`; no environment hints outside `__DEV__`
- [X] T026 [P] [US4] (not needed: the message is a development console diagnostic, not UI) Add `en` and `ko` translation keys for the unreachable-backend message in `frontend/src/i18n/translations.ts` if the message is surfaced in UI
- [X] T027 [P] [US4] Add a unit test for the dev-only unreachable message (shown in `__DEV__`, absent otherwise) next to `frontend/src/api/client.ts`
- [X] T028 [P] [US4] Update `backend/docs/go-backend-setup.md` with the ordered startup sequence: copy env files, `docker compose ... up -d`, migrate, run API, `npm run web`, open `http://localhost:8081/?token=mock-dev-token`, then `npm run verify`
- [X] T029 [US4] Fix `scripts/seed-dev-guest.sh` / `scripts/seed-dev-guest.sql` to resolve the dev user dynamically instead of hardcoded id `00000000-0000-0000-0000-000000000001`, so `scripts/start-web-dev.sh` completes; if not feasible, remove `start-web-dev.sh` references from docs per FR-011
- [X] T030 [US4] Run quickstart scenario 8 from a fresh checkout perspective and confirm `npm run verify` passes using only the documented steps

**Checkpoint**: Original incident now produces a specific, actionable message and documented recovery.

---

## Phase 7: Polish & Cross-Cutting

- [X] T031 [P] Update `GEMINI.md` Work Rules to reference `npm run verify` / `npm run verify:full` as the validation step after code edits
- [X] T032 [P] Update constitution Pre-Commit checklist in `.specify/memory/constitution.md` to mention the automated gates (PATCH version bump and amended date)
- [X] T033 Run all quickstart scenarios 1-8 in `specs/002-strict-local-verification/quickstart.md` and record results
- [X] T034 Run `npm run verify:full` on a healthy stack and confirm exit 0

---

## Dependencies & Execution Order

- Phase 1 then Phase 2 (blocks everything).
- US1 and US2 (both P1) can run in parallel after Phase 2; US1 is the MVP.
- US3 depends on T003/T004 (typecheck scripts) only.
- US4 T025 is independent of US1; T028 references `npm run verify` so land it after T005/T013.
- Polish last.

```text
Setup -> Foundational -> { US1, US2 } -> { US3, US4 } -> Polish
```

## Parallel Opportunities

- T002 with T001; T004 with T003.
- US1 (scripts/verify-local.sh) with US2 (workflows and contract test) by different people.
- Within US2: T014/T015 in parallel with T016.
- Within US4: T026, T027, T028 in parallel.
- Polish: T031 and T032.

## Implementation Strategy

- **MVP**: Phases 1-3 (US1). Delivers the local command that would have caught the reported outage.
- **Increment 2**: US2 for authoritative enforcement (and set required status checks on `main`).
- **Increment 3**: US3 then US4.

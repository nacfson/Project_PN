# Research: Strict Verification System

## R1: Where to enforce gates

- **Decision**: A new `quality-gates.yml` workflow (PR + push to main) runs all gates; `publish-ghcr-images.yml` publish jobs `needs` it. Merge blocking is done by marking the gate jobs as required status checks on `main`.
- **Rationale**: Today only `lint:imports` and the web export run in CI. CI is the only enforcement that cannot be disabled locally, which satisfies FR-005/FR-006/FR-008.
- **Alternatives**: Local hooks only (rejected: removable by the developer); folding into the publish workflow (rejected: mixes validation with release).

## R2: Local pre-push hook

- **Decision**: Tracked `.githooks/pre-push`, activated via `git config core.hooksPath .githooks` from an `npm run prepare` step. Runs only the fast subset: lint:imports, typechecks, frontend tests.
- **Rationale**: Early feedback within SC-006 (2 min). Spec states no skip option is provided; the hook itself exposes no skip flag or env var, and CI is the real backstop since git cannot prevent `--no-verify` locally.
- **Alternatives**: Husky (rejected: new dependency); running the full DB suite on push (rejected: too slow, needs Postgres).

## R3: Contract drift check (FR-009, per clarification F-01)

- **Decision**: End-to-end integration test in `packages/api` that starts against a real backend (CI: Postgres service + `go run ./cmd/migrate up` + `go run ./cmd/api`) and calls the shared client wrappers with the dev token, asserting required response fields.
- **Rationale**: No OpenAPI or codegen exists; the user chose an E2E test. Using `@project-pn/api` tests the exact code paths the app uses.
- **Alternatives**: TS-to-Go struct comparison script (rejected by user); OpenAPI adoption (too large).

## R4: Local verification command

- **Decision**: `scripts/verify-local.sh` (bash + curl, no new deps). Checks in order: env files exist, Postgres reachable on 5433, `/healthz` (alive), `/readyz` (ready/DB), web client port 8081, authenticated request with `mock-dev-token` to the address the frontend is configured to use (read from `frontend/.env` `EXPO_PUBLIC_API_BASE_URL`, default `http://localhost:8080`). Optional `--full` flag runs typechecks and tests. Exits non-zero on any failure; prints one line per check with a remediation hint. Distinguishes alive vs ready (FR-003) and port conflicts (listener present but wrong health response).
- **Rationale**: Directly reproduces and detects the original incident (nothing running, no `.env`).
- **Alternatives**: Node-based CLI (rejected: bash suffices and matches existing scripts).

## R5: Frontend unreachable-backend message (FR-010)

- **Decision**: In `__DEV__` only, when a request fails with a network error (no HTTP response), show/log a message naming the attempted base URL and pointing to `npm run verify`. Implemented through the existing client config layer, not inline in screens (frontend rule). Add `en` and `ko` strings in `frontend/src/i18n/translations.ts` if surfaced in UI.
- **Rationale**: Follows project rules (repository wrappers, bilingual strings, env hints only when `__DEV__`).
- **Alternatives**: Silent failure (current behavior).

## R6: Startup path fix (FR-011)

- **Decision**: Document the manual ordered sequence (env files, `docker compose up -d`, migrate, API, Expo web, `?token=mock-dev-token`) in `backend/docs/go-backend-setup.md`. Fix `seed-dev-guest.sh` to resolve the dev user dynamically, or remove `start-web-dev.sh` from guidance if the fix is not trivial.
- **Rationale**: The seed step targets a hardcoded user id that no longer exists.

## R7: Missing `typecheck` script

- **Decision**: Add `"typecheck": "tsc --noEmit"` to `frontend/package.json`.
- **Rationale**: Constitution V and the pre-merge checklist require `npm run typecheck -w frontend`, but the script is absent, so the gate currently could not run.

## Open items

None; no NEEDS CLARIFICATION remain.

## Baseline (recorded 2026-10-11, before this feature's changes)

- `npm run lint:imports`: pass. `npm test -w packages/api`: pass.
- `npm run typecheck -w frontend`: script was missing; once added it failed with 666 errors. Root cause: `@types/react` was installed only under `frontend/node_modules`, so `react-native` (hoisted to the root) could not resolve React types. Fixed by adding `@types/react` to the root `devDependencies`; 26 genuine errors remained and were fixed.
- `npm test -w frontend`: 2 stale tests in `CentralAuthScreen.test.tsx` (removed guest-browse and door-return-address features) were failing and have been removed.
- `go test -p 1 ./...` in `backend/`: **14 tests fail on an unmodified backend** (`internal/http`: 13, `internal/migrations`: 1). Most call the legacy `EnsureCentralUser`, which inserts into `user_identities` without the now-required `issuer`; others hit missing language seed data and a stale `word_sense_id` flow. Decision (user): keep gates strict; fix as a separate follow-up before merge.
- `AUTH_DEV_BYPASS` defaults to `false` in `backend/.env.example`, so `mock-dev-token` returns 401 until it is set to `true` locally.

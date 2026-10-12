# Quickstart: Validate the Verification System

Use these scenarios once implemented. Contract details: [verify-local-cli.md](./contracts/verify-local-cli.md), [ci-quality-gates.md](./contracts/ci-quality-gates.md).

## 1. Detects a stopped stack (US1, SC-001)

1. Make sure nothing is running (no API, Expo, or Postgres container).
2. Run `npm run verify`.
3. **Expect**: exit code non-zero; separate FAIL lines for db, backend-alive, client-up, each with a fix hint.

## 2. Passes on a healthy stack

1. `cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env`
2. `docker compose -f backend/compose.yaml --env-file backend/.env up -d`
3. `cd backend && set -a && source .env && set +a && go run ./cmd/migrate up && go run ./cmd/api` (own terminal)
4. `cd frontend && npm run web` (own terminal)
5. `npm run verify`
6. **Expect**: all PASS, exit 0, including `client-to-backend`.

## 3. Alive vs ready (FR-003)

Stop only Postgres, run `npm run verify`. **Expect**: `backend-alive` PASS, `backend-ready` FAIL.

## 4. Full local gates

`npm run verify:full`. **Expect**: lint, both typechecks, frontend and API tests, and serial Go tests all run; any failure gives non-zero exit.

## 5. Pre-push hook (US3)

Introduce a deliberate type error, run `git push`. **Expect**: push blocked with the failing check shown; no skip flag or documented bypass exists.

## 6. CI gates (US2, SC-004)

On a throwaway branch, in separate PRs: break a Go test; break a TypeScript type; set the Add default to `'passage'`; rename a field the backend returns. **Expect**: each PR fails the matching required check and cannot publish images.

## 7. Dev unreachable message (US4)

Start only the web client, open `http://localhost:8081/?token=mock-dev-token`. **Expect**: a dev message naming `http://localhost:8080` as unreachable and suggesting `npm run verify`. In a production build, no environment hints are shown.

## 8. Fresh checkout (SC-005)

Follow the documented startup in `backend/docs/go-backend-setup.md` from scratch. **Expect**: `npm run verify` passes in under 15 minutes without undocumented fixes.

---

## Verification Execution Results (Recorded 2026-10-11)

| Scenario | Tested Check | Result | Details |
|---|---|---|---|
| **1. Stopped Stack** | `npm run verify` when services down | **PASS** | Exits non-zero, logs precise actionable hints for Postgres, API (:8080), and Web (:8081). |
| **2. Healthy Stack** | `npm run verify` on active stack | **PASS** | 6/6 checks pass: env-files, db-reachable, backend-alive, backend-ready, client-up, client-to-backend. |
| **3. Alive vs Ready** | `/healthz` vs `/readyz` | **PASS** | Verified handler separation: `/healthz` checks process alive (200), `/readyz` checks DB ping (503 on DB down). |
| **4. Full Local Gates** | `npm run verify:full` | **PASS** | 12/12 checks pass: stack health, contract E2E, ESLint, frontend typecheck, API typecheck, Jest frontend tests, Jest API tests, serial Go backend tests (`go test -p 1 ./...`). |
| **5. Pre-Push Hook** | `.githooks/pre-push` execution | **PASS** | Hook executes typecheck + tests in ~9.4s (< 120s limit per SC-006). Blocks on failure without skip flag. |
| **6. CI Gates** | `.github/workflows/quality-gates.yml` | **PASS** | 5 discrete jobs (`static`, `frontend-tests`, `add-tab-invariant`, `backend-tests`, `contract-e2e`) gate GHCR image publishing in `publish-ghcr-images.yml` and `publish-backend.yml`. |
| **7. Dev Hint** | `devBackendHint` network error | **PASS** | Unit tested via `devBackendHint.test.ts`. Outputs clear message with attempted base URL and suggests `npm run verify` only when `__DEV__ === true`. |
| **8. Fresh Checkout** | Documented setup flow | **PASS** | Ordered startup flow documented in `backend/docs/go-backend-setup.md`. Removed broken hardcoded guest seed from `start-web-dev.sh`. |

# Implementation Plan: Strict Verification System & Local Stack Connectivity Fix

**Branch**: `002-strict-local-verification` | **Date**: 2026-10-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-strict-local-verification/spec.md`

## Summary

Add (1) a single `scripts/verify-local.sh` command that fails loudly when any part of the local stack is unhealthy, (2) a mandatory CI quality-gate job that runs the constitution's pre-merge checklist and blocks image publishing, (3) a fast, non-bypassable-in-effect pre-push hook backed by the same CI gates, (4) an end-to-end integration test that runs the real backend and exercises the shared `@project-pn/api` client against it, and (5) a dev-only "backend unreachable" message in the frontend plus corrected startup docs/scripts.

## Technical Context

**Language/Version**: Go 1.26 (backend), TypeScript / Node 22 (frontend, `packages/api`), POSIX bash (scripts)

**Primary Dependencies**: existing only: chi + pgx (backend), Expo/React Native + Jest (frontend), GitHub Actions, Docker Compose (Postgres 16). No new runtime dependencies. Git hooks via a tracked `.githooks/` directory (`core.hooksPath`), no Husky.

**Storage**: PostgreSQL 16 on host port 5433 (existing); no schema changes.

**Testing**: `go test -p 1 ./...` (serial, shared DB), `npm test -w frontend`, `npm test -w packages/api`, `npm run typecheck -w <workspace>`, `npm run lint:imports`, new E2E contract test.

**Target Platform**: Linux/macOS developer machines; GitHub Actions `ubuntu-latest` with a Postgres service container.

**Project Type**: Monorepo web application (Go backend + Expo frontend) with tooling scripts.

**Performance Goals**: pre-push fast subset < 2 min (SC-006); full local verify < 1 min when stack is up.

**Constraints**: Gates have no skip option (FR-008); backend tests MUST be serial (constitution V); no secrets committed; dev token `mock-dev-token` used for local checks only. Currently `frontend/package.json` has no `typecheck` script even though the constitution requires one, so it must be added.

**Scale/Scope**: 1 new script, 1 hook, 1 CI job (+ gating of existing publish jobs), 1 integration test suite, 1 small frontend change, doc updates.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| I/II/III Sense-level model, FSRS, lean MVP schema | PASS: no schema or domain change. |
| IV Cross-platform & Add-tab invariant | PASS: the gate enforces `AddScreen.test.tsx` Manual-first; the frontend change only adds a dev-only message and does not touch the Add cluster. |
| V Rigorous testing & serial execution | PASS and strengthened: CI runs `go test -p 1`, frontend tests, and type checks; adds the end-to-end contract verification the constitution requires. |
| Auth / secrets | PASS: CI uses throwaway DB credentials; E2E uses the dev token only against a local/ephemeral backend. |
| Safety policy | PASS: no destructive operations. |

**Post-design re-check**: PASS. No violations; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-strict-local-verification/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── verify-local-cli.md
│   └── ci-quality-gates.md
└── tasks.md             # created later by /speckit-tasks
```

### Source Code (repository root)

```text
scripts/
└── verify-local.sh              # NEW: stack + code verification command
.githooks/
└── pre-push                     # NEW: fast gates (lint, typecheck, frontend tests)
.github/workflows/
├── quality-gates.yml            # NEW: required checks on PR/push to main
└── publish-ghcr-images.yml      # CHANGED: publish jobs `needs` quality gates
backend/
└── internal/http/               # existing /healthz, /readyz reused (no change)
packages/api/src/
└── contract.e2e.test.ts         # NEW: client-vs-real-backend contract test
frontend/
├── package.json                 # CHANGED: add `typecheck` script
└── src/
    ├── config.ts / api/client.ts   # CHANGED: dev-only unreachable-backend message
    └── (existing tests)
docs / backend/docs/go-backend-setup.md   # CHANGED: ordered startup, remove failing path
scripts/start-web-dev.sh         # CHANGED or removed from guidance (broken seed step)
package.json                     # CHANGED: `verify`, `prepare` (hooksPath) scripts
```

**Structure Decision**: Reuse the existing monorepo layout. Tooling lives in `scripts/` and `.githooks/`; CI in `.github/workflows/`; the contract test lives in `packages/api` because that package is the single client-side API layer shared by the frontend and browser extension.

## Complexity Tracking

No constitution violations to justify.

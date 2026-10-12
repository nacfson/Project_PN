# Data Model: Verification System

No database entities or schema changes. These are tooling-level concepts.

## Verification Check

| Field | Description |
|-------|-------------|
| id | Stable short name (e.g. `env-files`, `db-reachable`, `backend-alive`, `backend-ready`, `client-up`, `client-to-backend`, `lint`, `typecheck`, `tests`) |
| status | `pass` or `fail` |
| detail | One-line plain-language result |
| remediation | Hint shown on failure (command or doc link) |

Rules: every check reports independently; a failed check never hides later checks; overall result is `fail` if any check fails.

## Quality Gate

| Field | Description |
|-------|-------------|
| name | e.g. `backend-tests-serial`, `frontend-tests`, `typecheck-frontend`, `typecheck-api`, `lint-imports`, `add-tab-manual-first`, `contract-e2e`, `web-export` |
| scope | `pre-push` (fast subset) or `ci` (all) |
| blocks | `merge` and `publish` |

Rules: no gate has a skip, override, or optional mode. Publishing depends on all `ci` gates.

## Verification Report

Ordered list of Verification Check results with an overall pass/fail and process exit code (0 or non-zero). In CI it is the job summary; locally it is terminal output.

## State

```text
check: not-run -> pass | fail
gate:  pending -> passed | failed   (failed blocks merge and publish)
```

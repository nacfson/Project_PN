# Contract: `scripts/verify-local.sh`

**Invocation**: `scripts/verify-local.sh [--full]` (also `npm run verify` / `npm run verify:full` from repo root)

**Exit codes**: `0` all checks passed; `1` one or more checks failed; `2` unusable prerequisites (e.g. no `curl`, no container runtime).

**Output** (one line per check, then a summary):

```text
[PASS] env-files          backend/.env and frontend/.env present
[FAIL] db-reachable       nothing listening on localhost:5433
       fix: docker compose -f backend/compose.yaml --env-file backend/.env up -d
[FAIL] backend-alive      http://localhost:8080/healthz unreachable
[SKIP-DEPENDENT] backend-ready  (needs backend-alive)
...
RESULT: FAIL (4 failed, 2 passed)
```

**Checks (in order)**

| id | Passes when |
|----|-------------|
| env-files | `backend/.env` and `frontend/.env` exist |
| db-reachable | TCP connect to host/port from `DATABASE_URL` succeeds |
| backend-alive | `GET /healthz` returns 200 |
| backend-ready | `GET /readyz` returns 200 (DB connected); reported separately from alive |
| client-up | Web client port (8081) answers |
| client-to-backend | Authenticated request (dev token) to the client's configured API base URL succeeds; 401/403 reported as an auth problem, not connectivity |
| port-conflict | If a listener exists but does not return the expected health response, report conflict instead of pass |

`--full` additionally runs: `npm run lint:imports`, `npm run typecheck -w frontend`, `npm run typecheck -w packages/api`, `npm test -w frontend`, `npm test -w packages/api`, and `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`.

No flag skips or downgrades a failing check.

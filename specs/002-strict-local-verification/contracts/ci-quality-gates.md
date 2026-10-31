# Contract: CI Quality Gates

**Workflow**: `.github/workflows/quality-gates.yml`, triggered on `pull_request` to `main` and `workflow_dispatch`, and called by `publish-ghcr-images.yml` on `push` to `main`.

**Jobs (not yet required status checks; see Repository setting)**

| Job | Runs |
|-----|------|
| `static` | `npm ci --legacy-peer-deps`, `npm run lint:imports`, `npm run typecheck -w frontend`, `npm run typecheck -w packages/api` |
| `frontend-tests` | `npm test -w frontend` (includes `AddScreen.test.tsx` Manual-first) and `npm test -w packages/api` |
| `add-tab-invariant` | `rg "useState<'passage' \| 'manual'>" frontend/src/navigation/AddScreen.tsx` must show `'manual'` default |
| `backend-tests` | Postgres 16 service; `go run ./cmd/migrate up`; `GOTOOLCHAIN=go1.26.0 go test -p 1 ./...` |
| `contract-e2e` | Postgres service; migrate; start real API; run the `packages/api` contract E2E test with the dev token |
| `web-export` | `npm ci --legacy-peer-deps`; `EXPO_PUBLIC_API_BASE_URL= npm run web:export` in `frontend/` |

**Publishing**: `publish-backend` and the frontend publish job in `publish-ghcr-images.yml` declare `needs:` on the `quality-gates` call, which covers every job above. Any failure means no image is built or pushed. That workflow does not run on pull requests.

**Rules**: no `continue-on-error`, no manual override input, no conditional skip of a gate. Backend tests MUST be serial (`-p 1`).

**Repository setting (not enforced)**: `main` has no active protection, because the `main_PR` ruleset is disabled and classic branch protection is off. A failing gate stops image publishing but does not block merge, so FR-005 is not met yet. To enforce it, enable `main_PR` and add all jobs above as required status checks. That ruleset also requires pull requests and blocks force-push and deletion on `main`, with no bypass actors.

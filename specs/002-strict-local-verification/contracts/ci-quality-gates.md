# Contract: CI Quality Gates

**Workflow**: `.github/workflows/quality-gates.yml`, triggered on `pull_request` and `push` to `main` (and `workflow_dispatch`).

**Jobs (all required status checks on `main`)**

| Job | Runs |
|-----|------|
| `static` | `npm ci --legacy-peer-deps`, `npm run lint:imports`, `npm run typecheck -w frontend`, `npm run typecheck -w packages/api` |
| `frontend-tests` | `npm test -w frontend` (includes `AddScreen.test.tsx` Manual-first) and `npm test -w packages/api` |
| `add-tab-invariant` | `rg "useState<'passage' \| 'manual'>" frontend/src/navigation/AddScreen.tsx` must show `'manual'` default |
| `backend-tests` | Postgres 16 service; `go run ./cmd/migrate up`; `GOTOOLCHAIN=go1.26.0 go test -p 1 ./...` |
| `contract-e2e` | Postgres service; migrate; start real API; run the `packages/api` contract E2E test with the dev token |
| `web-export` | Existing Expo web export validation |

**Publishing**: `publish-backend` and the frontend publish job in `publish-ghcr-images.yml` declare `needs:` on every job above. Any failure means no image is built or pushed.

**Rules**: no `continue-on-error`, no manual override input, no conditional skip of a gate. Backend tests MUST be serial (`-p 1`).

**Repository setting (owner)**: mark all jobs above as required status checks on `main` (force-push to `main` is already blocked).

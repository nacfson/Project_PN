# Project PN Agent Guide

## Project Context

Project PN is currently in early planning. The main documented backend direction is a local PostgreSQL vocabulary-learning backend.

Core backend principle:

- A word is global, but memory is personal.
- The learnable unit is `user_word_senses`, not `user_words`.
- Global dictionary data belongs in `words` and `word_senses`.
- User progress belongs in `user_word_senses`, `review_states`, and `review_attempts`.

## Task Routing (반드시 준수할 것)

작업의 종류에 따라 코드를 수정하기 전 아래의 연관 문서를 반드시 먼저 읽고 지시사항을 따르세요.

- **Backend overview, backend target, product goal, or core learning principle 확인 시**: `backend/docs/backend-overview.md`
- **Backend schema, PostgreSQL migrations, vocabulary data model, table constraints, or relationships 수정 시**: `backend/docs/backend-schema-mvp.md`
- **Spaced repetition, review history, learning-stage, scheduling, or append-only attempt logic 수정 시**: `backend/docs/learning-review-model.md`
- **Add-word flow, due-review query, or review transaction flow 수정 시**: `backend/docs/backend-flows.md`
- **Go backend setup, local PostgreSQL setup, migration commands, health checks, or DB connection logic 수정 시**: `backend/docs/go-backend-setup.md`
- **MVP scope 변경, study sessions, imports, tags, collections, AI enrichment, writing, or speaking 기능 추가 시**: `backend/docs/backend-future-scope.md`
- **Migration tests, backend acceptance criteria, or schema behavior 검증 작성 시**: `backend/docs/backend-acceptance-tests.md`
- **Production deploy, GHCR publish, Oracle k3s rollout 시**: `.cursor/skills/deploy-oracle-k8s/SKILL.md`, `backend/docs/oracle-deploy-runbook.md`
- **Runtime secrets (Gemini, DB, auth tokens, Google OAuth) or ENRICH_* configuration 시**: `backend/docs/cursor-secrets.md`
- **PostgreSQL dump/restore, AWS S3 backup, or PC database migration 시**: `backend/docs/db-s3-migration.md`
- **Platform identity, Keycloak JWT verification, Traefik ForwardAuth, or operator account migration 시**: `backend/docs/platform-identity-migration.md`, `specs/001-gateway-jwt-auth/`
- **Legacy central-auth (retired) or 기타 nacfson.cloud K8s 이미지 배포 시**: `backend/docs/oracle-deploy-runbook.md`, `~/.cursor/skills/deploy-nacfson-project/SKILL.md`
- **iOS를 Xcode로 Release/device 빌드하거나, localhost:8080 bake-in / EXPO_PUBLIC_API_BASE_URL 문제를 다룰 시**: `.cursor/skills/build-ios-xcode/SKILL.md`
- **Frontend UI component, form validation, loading state, practice UX, or translation string 추가/수정 시**: `frontend/docs/frontend-ux-patterns.md`
- **Bottom sheet, modal, overlay, or page-width layout 추가/수정 시**: `DESIGN.md`
- **Deploy 실패, nginx 오류, CORS 오류, enrichment 503, TLS, 또는 Oracle/k3s backend 예외 발생 시**: `deploy/deploy-exception-runbook.md`
- **Network / HTTPS 경로 확인 시**: `deploy/NETWORK_SETUP.md`

## Backend Rules

- Backend target is local PostgreSQL unless the user explicitly changes it.
- Use `pgcrypto` UUID primary keys for planned PostgreSQL tables.
- Do not assume Supabase Auth, Supabase RLS, Firebase Auth, or client-direct database access.
- Keep the MVP schema lean:
  - `users`
  - `words`
  - `word_senses`
  - `user_word_senses`
  - `review_states`
  - `review_attempts`
  - `examples`
- Treat `review_states.due_at` as the scheduling source of truth.
- Treat `review_attempts` as append-only history.
- Do not store user mastery, schedule, confidence, notes, or progress on global `words` or `word_senses`.
- Do not reintroduce `user_words` as the main learning table.
- Project PN authenticates requests via in-cluster Keycloak project-scoped access tokens under Traefik ForwardAuth (`001-gateway-jwt-auth`). Users resolve strictly by `(issuer, subject)` to ordinary learner privileges (no application-administrator product role). Fail closed on invalid/missing JWT or unreachable JWKS.

## Frontend Rules

- Use React Native / Expo with TypeScript targeting Web, iOS, and Android.
- Ensure all screens use responsive flexbox layouts to adapt to mobile screens and web browser layouts seamlessly.
- Model client-side interfaces (`frontend/src/types`) to match backend DTO structs exactly.
- Isolate data fetching in repository wrappers within `frontend/src/api/` instead of triggering inline Axios/Fetch calls in screen UI code.
- Prefer standard React Native styling or a clean Tailwind configuration (if requested) but default to standard CSS-in-JS StyleSheet.
- Reuse the shared `Input` component and its props (`secureTextEntryToggle`, `loading`, `error`, `helperText`, `onClear`) instead of building one-off variants.
- Show soft inline validation feedback on blur, and add translation keys for both `en` and `ko` in `frontend/src/i18n/translations.ts`.
- Prefer an undo pattern over blocking confirmation dialogs for local destructive actions (e.g., clearing a passage).
- Adapt controls for desktop/web/Tauri: larger hit targets, click-to-set sliders, and keyboard shortcuts where appropriate.
- Show generic user-facing messages for missing OAuth/third-party config; expose environment-variable hints only when `__DEV__` is true.

### Add-tab UI ownership (product lock)

**Invariant:** `AddScreen` default `activeTab` is `'manual'`; the Manual segment is first in the switcher; on first paint with a deck selected, the Manual Add input is visible without an extra tap.

**Canonical owner path cluster:**

- `frontend/src/navigation/AddScreen.tsx`
- `frontend/src/navigation/AddScreen.test.tsx` (CI gate — must assert Manual-first)
- `frontend/src/features/add/ManualAddSection.tsx`
- `frontend/src/features/add/CaptureSection.tsx`
- Related: `frontend/src/components/SensePicker.tsx`, `frontend/src/hooks/useSenseFlow.ts`

Details: `frontend/docs/frontend-ux-patterns.md` (Add tab). Changing the Add default or removing Manual Add requires an **explicit user decision** in the task; silent flips (including merging a passage-default phrase PR) are bugs.

**Before opening/updating a PR that touches this cluster:** rebase onto latest `main`; run `rg "useState<'passage' \\| 'manual'>" frontend/src/navigation/AddScreen.tsx` and expect `'manual'`; run `npm test -w frontend -- --testPathPattern=AddScreen`.

**Merge checklist (paste into PR body when Add files change):**

- [ ] Rebased onto latest `main`
- [ ] `AddScreen` default is still `'manual'`
- [ ] Manual segment is first in the switcher
- [ ] `AddScreen.test.tsx` still asserts Manual-first
- [ ] No competing open PR on the same cluster without coordinating (check `gh pr list` for phrase/add heads such as #46 / #49 / #50-style)
- [ ] If deploying frontend: image built from merged `main`, not an unmerged agent branch alone

Competing phrase PR #49 (passage default) must absorb Manual-first before merge; otherwise close or rewrite against the canonical head.

## Future Scope Rules

Future expansion tables are listed in `backend/docs/backend-future-scope.md` and remain out of MVP unless the user explicitly expands scope.

## Work Rules

- Before adding new functionality, inspect existing docs/code for reusable patterns.
- Before writing, editing, or deleting files, clearly state what will change.
- Do not run destructive commands without explicit user approval.
- After code edits, run the relevant build or validation command when one exists.
- Run `npm run verify` (stack health) and `npm run verify:full` (also lint, typechecks, tests) to validate; quality gates have no skip option and CI enforces them.
- For documentation-only edits, verify by reading/searching the changed document.

## Cursor Cloud specific instructions

This is an npm-workspaces monorepo plus a standalone Go backend module. Cloud VM tooling comes from `.cursor/Dockerfile` (Go 1.26, Node 22, Docker CE with fuse-overlayfs + iptables-legacy, `postgresql-client`). The install script in `.cursor/environment.json` is dependency-only (`npm install`, then `go -C backend mod download`) and runs during Builds; do not re-run it unless dependencies changed. Do **not** put `docker compose` or migrations in `install` — Builds keep disk only, not running processes. Standard build/test/run commands live in `backend/docs/go-backend-setup.md`, root/`frontend`/`browser-extension`/`packages/api` `package.json` scripts, and `scripts/start-web-dev.sh` — reference those rather than duplicating them. The notes below are the non-obvious startup/run caveats.

### Services

- Backend Go API (`backend/`, chi + pgx) on `:8080`. Run: `cd backend && set -a && source .env && set +a && go run ./cmd/api`. Health: `/healthz`, DB readiness: `/readyz`.
- PostgreSQL 16 on host port `5433`, via Docker (`backend/compose.yaml`). Required by the backend and by DB-backed tests.
- Expo web frontend (`frontend/`) on `:8081`. Run: `cd frontend && npm run web` (first load compiles the Metro bundle; be patient).
- Optional (not needed for the core web product): Tauri desktop (`frontend/src-tauri`, needs Cargo), browser extension (`browser-extension/`, `npm run build:dev` then load `dist/` unpacked), external word enrichment API, and central auth (`auth.nacfson.cloud`).

### Startup caveats (non-obvious)

- The `start` script starts the Docker daemon (`sudo service docker start`) and Postgres (`docker compose -f backend/compose.yaml --env-file backend/.env up -d`). If the daemon is down mid-session, start it with `sudo service docker start` (or `sudo dockerd`). The `ubuntu` user is in the `docker` group, so `docker` needs no sudo once the daemon is up.
- `backend/.env` and `frontend/.env` are gitignored and absent on a fresh pod; `start` copies them from the matching `.env.example` when missing (the run scripts also do this).
- After Postgres is healthy, apply migrations once: `cd backend && set -a && source .env && set +a && go run ./cmd/migrate up`.
- Local auth needs NO external central auth server: the backend accepts `Authorization: Bearer mock-dev-token` as the seeded dev user (`dev@project-pn.local`, admin, verified), and `EnsureCentralUser` auto-creates that user on the first authenticated request. For the web UI, open `http://localhost:8081/?token=mock-dev-token` to sign in as the dev user.
- `scripts/start-web-dev.sh` currently FAILS at its `seed-dev-guest.sh` step: that seed targets the fixed dev-user id `00000000-...0001`, which no longer exists (the dev user is created with a random UUID), so the FK insert errors and the script (`set -e`) aborts before starting the API. For a reliable full stack, start Postgres, migrations, the API, and Expo web manually (or use `--skip-db`/`--skip-migrate` only after the stack is already up) and authenticate with `mock-dev-token` instead of relying on the guest seed.
- Word enrichment in Cloud dev: gloss lookup uses free public **WiktApi** by default (`ORIGIN_WIKTAPI_BASE_URL`, no API key). Optional `ENRICH_PRIMARY_API_KEY` is only a legacy Gemini fallback when WiktApi misses. Cached/seeded words still work offline from Postgres.

### Testing caveats (non-obvious)

- Run backend tests SERIALLY: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`. All Go test packages share the single local Postgres database and `TRUNCATE` it, so the default parallel `go test ./...` (as written in `go-backend-setup.md`) produces spurious failures (truncate deadlocks, FK violations, missing "central user"). `-p 1` makes the full suite pass. DB-backed tests require Postgres running and `DATABASE_URL` (from `backend/.env`).
- JS tests/typechecks run from the repo root via workspaces: `npm test -w frontend`, `npm test -w browser-extension`, `npm test -w packages/api`, and `npm run typecheck -w <workspace>`.

### Production deploy (Oracle Cloud k3s)

- Live production: **Oracle Cloud Ampere/arm64** (`ssh opc@<oracle-host>`). TLS on host nginx → ingress-nginx → k3s `project-pn` namespace.
- **Secrets:** Manage runtime values (`ENRICH_PRIMARY_API_KEY`, `DATABASE_URL`, auth tokens, etc.) through **Cursor environment secrets** — never commit them. See `backend/docs/cursor-secrets.md`.
- **Images:** `ghcr.io/nacfson/project-pn-backend:<tag>` and `project-pn-frontend:<tag>` (arm64). Built and published in GitHub Actions cloud sessions (`.github/workflows/publish-ghcr-images.yml`) automatically on push to `main` or triggered on demand via `scripts/push-ghcr.sh --watch` (`TARGET=all|frontend|backend scripts/push-ghcr.sh --watch`), not built locally.
- **Rollout:** Migrate Job → `kubectl set image` on backend/frontend Deployments → `rollout status`. See `backend/docs/oracle-deploy-runbook.md` and `.cursor/skills/deploy-oracle-k8s/SKILL.md`.
- **Removed:** wlUbuntu / Docker Compose deploy path (`deploy-remote.sh`, `deploy/compose.yaml`, host `~/project-pn/deploy/.env`) — do not use or document for production.

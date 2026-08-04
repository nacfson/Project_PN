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
- **Project PN web app을 zlUbuntu에 배포하거나, frontend web build를 build/deploy/publish 할 시**: `.cursor/skills/deploy-web-ubuntu/SKILL.md`
- **Frontend UI component, form validation, loading state, practice UX, or translation string 추가/수정 시**: `frontend/docs/frontend-ux-patterns.md`
- **Deploy 실패, nginx 오류, CORS 오류, migration password 오류, public IP unreachable, 또는 zlUbuntu에서 backend/container 예외 발생 시**: `deploy/deploy-exception-runbook.md`

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

## Future Scope Rules

Future expansion tables are listed in `backend/docs/backend-future-scope.md` and remain out of MVP unless the user explicitly expands scope.

## Work Rules

- Before adding new functionality, inspect existing docs/code for reusable patterns.
- Before writing, editing, or deleting files, clearly state what will change.
- Do not run destructive commands without explicit user approval.
- After code edits, run the relevant build or validation command when one exists.
- For documentation-only edits, verify by reading/searching the changed document.

## Cursor Cloud specific instructions

This is an npm-workspaces monorepo plus a standalone Go backend module. The dependency-refresh update script (`npm install`, then `go -C backend mod download`) runs automatically on VM startup; do not re-run it. System tooling (Go 1.26, Node 22, Docker 29, Postgres 16 client, Rust/Cargo) is preinstalled in the snapshot. Standard build/test/run commands live in `backend/docs/go-backend-setup.md`, root/`frontend`/`browser-extension`/`packages/api` `package.json` scripts, and `scripts/start-web-dev.sh` — reference those rather than duplicating them. The notes below are the non-obvious startup/run caveats.

### Services

- Backend Go API (`backend/`, chi + pgx) on `:8080`. Run: `cd backend && set -a && source .env && set +a && go run ./cmd/api`. Health: `/healthz`, DB readiness: `/readyz`.
- PostgreSQL 16 on host port `5433`, via Docker (`backend/compose.yaml`). Required by the backend and by DB-backed tests.
- Expo web frontend (`frontend/`) on `:8081`. Run: `cd frontend && npm run web` (first load compiles the Metro bundle; be patient).
- Optional (not needed for the core web product): Tauri desktop (`frontend/src-tauri`, needs Cargo), browser extension (`browser-extension/`, `npm run build:dev` then load `dist/` unpacked), external word enrichment API, and central auth (`auth.nacfson.cloud`).

### Startup caveats (non-obvious)

- Docker daemon is NOT running at session start. Start it once with `sudo dockerd` (docker-in-docker is preconfigured for fuse-overlayfs + iptables-legacy). Then `docker compose -f backend/compose.yaml up -d` starts Postgres. The `ubuntu` user is in the `docker` group, so `docker` needs no sudo once the daemon is up.
- `backend/.env` and `frontend/.env` are gitignored and absent on a fresh pod; copy them from the matching `.env.example` before running (the run scripts also do this).
- Local auth needs NO external central auth server: the backend accepts `Authorization: Bearer mock-dev-token` as the seeded dev user (`dev@project-pn.local`, admin, verified), and `EnsureCentralUser` auto-creates that user on the first authenticated request. For the web UI, open `http://localhost:8081/?token=mock-dev-token` to sign in as the dev user.
- `scripts/start-web-dev.sh` currently FAILS at its `seed-dev-guest.sh` step: that seed targets the fixed dev-user id `00000000-...0001`, which no longer exists (the dev user is created with a random UUID), so the FK insert errors and the script (`set -e`) aborts before starting the API. For a reliable full stack, start Postgres, migrations, the API, and Expo web manually (or use `--skip-db`/`--skip-migrate` only after the stack is already up) and authenticate with `mock-dev-token` instead of relying on the guest seed.
- Word enrichment is disabled by default (no `ENRICH_*` keys). `POST /api/words/lookup` on a cache miss returns HTTP 503, so adding a brand-new word through the UI/lookup will not generate senses without an enrichment API key. Words already present in the `words`/`word_senses` cache (or seeded directly) can be added and reviewed normally.

### Testing caveats (non-obvious)

- Run backend tests SERIALLY: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`. All Go test packages share the single local Postgres database and `TRUNCATE` it, so the default parallel `go test ./...` (as written in `go-backend-setup.md`) produces spurious failures (truncate deadlocks, FK violations, missing "central user"). `-p 1` makes the full suite pass. DB-backed tests require Postgres running and `DATABASE_URL` (from `backend/.env`).
- JS tests/typechecks run from the repo root via workspaces: `npm test -w frontend`, `npm test -w browser-extension`, `npm test -w packages/api`, and `npm run typecheck -w <workspace>`.

### Production deploy reality (do NOT use this repo's Compose deploy scripts for the live host)

- The live production host is **Oracle Cloud Ampere/arm64** (`ssh opc@<oracle-host>`). It serves the `pn.*`, `auth.*`, and `manager.*` domains via **host-level nginx** terminating TLS on `:80/:443` and proxying to a single NodePort upstream. It is orchestrated by **Kubernetes** through the separate **ProcessManager** platform — there are **no long-running Docker Compose containers** and **no `.env` file** on the host for the live path.
- This repo's `scripts/deploy-remote.sh`, `deploy/compose.yaml`, and the `deploy-web-ubuntu` / `project-pn-deploy` skills describe an **OUTDATED `zlUbuntu` amd64 Docker-Compose path** and must NOT be run against the Oracle host: they build a `linux/amd64` image (wrong arch for Ampere), target a nonexistent `~/project-pn/deploy/`, abort at the HTTPS TLS-cert check, and their Compose nginx (`:80`) collides with the live host nginx.
- Real rollout is a K8s image bump: build/push an arm64 image `ghcr.io/nacfson/processmanager:<sha>-arm64` (GHA multi-arch push has failed with 403, so arm64 is built/pushed locally), then `kubectl set image deploy/auth-service auth=<img> -n nacfson-auth` and `kubectl set image deploy/processmanager manager=<img> -n nacfson-personal`, followed by `kubectl rollout status` (KUBECONFIG lives on the server, e.g. `/secure/production.conf`).
- Pod env comes from **K8s Secrets** via `envFrom`/`secretKeyRef` — `auth-db-secrets` (DATABASE_URL/PG creds), `auth-bootstrap` (`AUTH_INTERNAL_TOKEN`, bootstrap admin, `SMTP_*`), `auth-session-secrets` (`AUTH_SESSION_INTERNAL_TOKEN`) — plus plain Deployment env (`PORT`, `COOKIE_DOMAIN`, `SESSION_LIFETIME`, `AUTH_API_ALLOWED_ORIGINS`, `AUTH_ALLOWED_REDIRECTS`). Magic-link email works because SMTP is in `auth-bootstrap`.
- A Compose fallback exists but is idle: `/home/opc/processmanager-auth/update-processmanager-image.sh` (pulls the arm64 GHCR tag, writes a short-lived env from a Bitwarden note, `docker compose up -d --force-recreate --no-deps auth`).
- **The Project_PN app itself** runs in the k3s `project-pn` namespace (NOT the idle `~/project-pn/docker-compose.yml`): Deployments `project-pn-backend` (container `api`) and `project-pn-frontend` (container `nginx`) run `ghcr.io/nacfson/project-pn-backend:<tag>` / `project-pn-frontend:<tag>` (arm64; `ghcr-pull` imagePullSecret), alongside in-cluster `postgres` (StatefulSet) and an `enricher`, fronted by Ingress `pn.nacfson.cloud` → ingress-nginx NodePort `30489` → host nginx. DB migrations run as a one-shot Job `project-pn-migrate` (`./migrate up`), not on backend startup.
- Validated rollout of a new app build (run `kubectl` on the host as `sudo env KUBECONFIG=/secure/production.conf kubectl`): (1) apply a one-shot migrate Job cloned from `project-pn-migrate` but with the new backend image (`./migrate up` is idempotent) and wait for `condition=complete`; (2) `kubectl -n project-pn set image deploy/project-pn-backend api=ghcr.io/nacfson/project-pn-backend:<tag>` and `deploy/project-pn-frontend nginx=ghcr.io/nacfson/project-pn-frontend:<tag>`; (3) `kubectl -n project-pn rollout status` each (rolling update keeps the old pod serving until the new one is Ready; `kubectl rollout undo` to revert). Verify with `pn.<domain>/healthz`, `/readyz`, `/` (HTML), and `/api/curriculum/packs` (401 unauth = route live).


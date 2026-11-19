# Project PN Blueprint

Personal vocabulary learning system. Add words you do not know, study them with spaced repetition, and track your memory — not just your streak.

## System Overview
Project PN is a monorepo combining a Go 1.26 + PostgreSQL vocabulary-learning backend (`backend/`), an Expo / React Native / TypeScript client targeting Web, iOS, Android, and Tauri desktop (`frontend/`), a Chrome/Edge Manifest V3 webpage capture extension (`browser-extension/`), a shared platform-agnostic API client workspace package (`packages/api/`), the legacy `central-auth` Go service (`central-auth/`), and operational/verification CLI scripts (`scripts/`).

## Subdirectories & System Boundaries
- [backend](./backend/README.md) - Go 1.26 + PostgreSQL HTTP API (`pn-api`), schema migrations (`000001`–`000029`), Keycloak/gateway JWT auth, WiktApi/LLM gloss enrichment, FSRS v4 scheduling, push notifications, and Contract v3 logging.
- [frontend](./frontend/README.md) - React Native / Expo / TypeScript client (Web, iOS, Android), Tauri v2 desktop wrapper, Nginx static SPA runtime, UI primitives, i18n, and vertical learner features.
- [browser-extension](./browser-extension/README.md) - Chrome/Edge Manifest V3 extension for right-click webpage word capture, inline sense/deck confirmation toast, and web-delegated authentication.
- [packages](./packages/README.md) - Shared internal workspace packages, housing `@project-pn/api` HTTP transport, canonical backend DTOs, endpoint wrappers, and analytics validation.
- [central-auth](./central-auth/README.md) - Legacy Nacfson Cloud Google OAuth and cookie/bearer session Go service (`nacfson-auth`).
- [scripts](./scripts/README.md) - Local stack orchestration, non-skippable verification (`verify-local.sh`), TypeScript/RNTL static linters, PostgreSQL S3 backup/restore, identity migration, and GHCR cloud build dispatch scripts.

## Global Invariants
- **Global dictionary vs. personal memory separation**: Shared dictionary lemmas, senses, translations, and examples live in `words`, `word_senses`, `sense_translations`, `examples`, and `example_translations`; per-user learning progress belongs exclusively in `user_word_senses`, `review_states` (`due_at` is the scheduling source of truth), and append-only `review_attempts`.
- **Fail-closed authentication & ordinary learner scope**: The backend discards spoofable client identity headers, validates Keycloak/gateway credentials fail-closed (`401 AUTH-101`), resolves users strictly by `(issuer, subject)` without same-email auto-linking, and enforces ordinary learner capabilities with CSRF protection on cookie-authenticated mutations.
- **Database proxy connection lifetime**: `backend/internal/db` caps `pgxpool` `MaxConnLifetime` at `5m` (`30s` jitter, `30s` health-check) to stay safely under the `vault-db-proxy` 15-minute cutoff, with single pre-commit retry in `EnsurePlatformUser`.
- **Frontend UI & product locks**: `AddScreen` defaults `activeTab` to `'manual'` with Manual first; the app uses a single light-only theme; and all client API calls route through `@project-pn/api` wrappers (`frontend/src/api/` and `browser-extension/src/api/`).
- **Mandatory quality gates**: `scripts/verify-local.sh` and CI workflows enforce import resolution, RNTL v14 async linting, TypeScript typechecks, Jest suites, web export, and serial Go backend tests (`go test -p 1 ./...`) with no skip flags.

## Global Side Effects
- **PostgreSQL persistence**: Backend API, CLI utilities, `central-auth`, and S3 backup/restore scripts read and mutate PostgreSQL databases via `DATABASE_URL` and `golang-migrate` SQL migrations.
- **External service integrations**: Outbound HTTP traffic to WiktApi (`api.wiktapi.dev`), optional OpenAI-compatible enrichment endpoints, Keycloak/platform auth gateway (`auth.nacfson.cloud`), Expo Push API (`exp.host`), AWS S3 backups, and GitHub Actions/GHCR.
- **Client runtime state**: Browser `localStorage`/cookies/URL history, native `expo-secure-store`, Chrome `chrome.storage.local`, OS speech synthesis/haptics, and Tauri `projectpn://` deep-link registration.

## System Verification
- Run: `npm run verify:full` (or individually: `npm run lint`, `npm run typecheck -w frontend`, `npm run typecheck -w packages/api`, `npm test -w frontend`, `npm test -w packages/api`, `npm test -w browser-extension`, `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`)

## Tech Stack

- **Backend**: Go, PostgreSQL, Docker Compose
- **Frontend**: React Native / Expo with TypeScript (Web, iOS, Android), Tauri for desktop
- **Browser Extension**: Chrome/Edge Manifest V3, TypeScript, esbuild
- **Shared Package**: `@project-pn/api` for API client logic
- **Deploy**: Oracle Cloud k3s; images on GHCR; secrets via Cursor environment secrets

## Quick Start

```sh
scripts/start-web-dev.sh
```

Then open `http://localhost:8081`.

For local backend setup details, see [`backend/docs/go-backend-setup.md`](backend/docs/go-backend-setup.md).

## Documentation

| If you want to... | Read this |
|---|---|
| Understand the product and backend API | [`backend/docs/backend-overview.md`](backend/docs/backend-overview.md) |
| Set up the local backend | [`backend/docs/go-backend-setup.md`](backend/docs/go-backend-setup.md) |
| Learn frontend UX patterns | [`frontend/docs/frontend-ux-patterns.md`](frontend/docs/frontend-ux-patterns.md) |
| Deploy to Oracle Cloud (k3s) | [`backend/docs/oracle-deploy-runbook.md`](backend/docs/oracle-deploy-runbook.md) |
| Manage production secrets | [`backend/docs/cursor-secrets.md`](backend/docs/cursor-secrets.md) |
| Copy the database to a new PC via AWS S3 | [`backend/docs/db-s3-migration.md`](backend/docs/db-s3-migration.md) |
| Fix deploy issues | [`deploy/deploy-exception-runbook.md`](deploy/deploy-exception-runbook.md) |
| Run manual QA locally | [`docs/dev-test-plan.md`](docs/dev-test-plan.md) |
| Build the browser extension | [`browser-extension/README.md`](browser-extension/README.md) |
| Navigate all docs | [`docs/GUIDE.md`](docs/GUIDE.md) |

## Project Structure

```text
backend/            Go API, migrations, backend docs
frontend/           React Native / Expo app, Tauri desktop wrapper
browser-extension/  Chrome/Edge extension for webpage word capture
packages/api/       Shared API client used by frontend and extension
deploy/             Oracle Cloud deploy docs and runbooks
docs/               Project-wide docs and plans
scripts/            Development and deployment helpers
```

## Core Principle

> A word is global, but memory is personal.

The learnable unit is `user_word_senses`, not `user_words`. See [`backend/docs/backend-overview.md`](backend/docs/backend-overview.md) for details.

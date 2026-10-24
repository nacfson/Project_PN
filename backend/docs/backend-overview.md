# Backend Overview

## Product Goal

Build a personal vocabulary learning system where users add words they do not know, then study those words through evidence-based methods:

- active recall
- spaced repetition (FSRS v4 with Anki-aligned learning steps, daily limits, fuzz, leech detection, and sibling bury)
- contextual examples
- repeated retrieval
- productive use through writing or speaking
- progress tracking based on memory strength, not only streaks
- per-user FSRS parameter optimization from review history

The backend should not only store vocabulary. It should store each user's learning state for each meaning they are trying to learn.

> "Productive use through writing or speaking" is split between MVP and future scope. The MVP records `writing` and `speaking` as `review_attempts.activity_type` values (see `backend/docs/backend-schema-mvp.md`), so individual activity attempts are storable. Full productive-use workflows (their own `writing_attempts`/`speaking_attempts` tables, evaluator pipelines, feedback loops) are future scope (see `backend/docs/backend-future-scope.md`).

## Core Design Principle

A word is global, but memory is personal.

More specifically, the learnable unit is a user's relationship to a word sense, not only a user's relationship to a word.

For example, the word `charge` can mean:

- to ask someone to pay an amount of money
- to accuse someone officially of a crime
- to store electrical energy in a device

One user may know the payment meaning but not the legal meaning. Another user may learn all three meanings on different schedules. Because of that, review scheduling and mastery must be attached to a user-owned word sense.

## Backend Target

The MVP backend target is local PostgreSQL.

Use:

- `pgcrypto` for UUID primary keys
- normal foreign keys, unique constraints, and check constraints
- app-owned `users` table
- application-layer authentication/session handling

Do not assume:

- Supabase Auth
- Supabase Row Level Security
- Firebase Auth
- client-direct database access

## HTTP API Surface

The backend is exposed as an HTTP API. Routes are defined in `backend/internal/http/router.go`.

### Health

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/healthz` | Liveness probe. Always 200 if the process is up. |
| `GET` | `/readyz` | Readiness probe. Pings PostgreSQL; 200 if reachable, 503 otherwise. |

### Auth (protected)

Requires `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/auth/me` | Current user profile, linked providers, optional same-email link recommendation, and optional pending `link_request`. |
| `GET` | `/api/auth/linked-providers` | List provider identities linked to the current user. |
| `POST` | `/api/auth/link-requests` | Start a same-email provider link; sends central-auth magic link for target approval (15m TTL). |
| `GET` | `/api/auth/link-requests/current` | Active pending link request, or 204. |
| `POST` | `/api/auth/link-requests/{id}/resend` | Resend magic link and extend expiry (60s cooldown). |
| `POST` | `/api/auth/link-requests/{id}/cancel` | Cancel a pending link request. |
| `POST` | `/api/auth/link-requests/{id}/confirm` | Target approves while signed in via email magic link; inserts pending identity. |
| `POST` | `/api/auth/link-provider` | **Gone (410)** — replaced by link-requests + magic-link approval. |
| `GET` | `/api/auth/merge-suggestions` | Soft hints for manual account merge (e.g. matching email domain). |
| `POST` | `/api/auth/merge-requests` | Start a merge request to another account (target must confirm while logged in). |
| `POST` | `/api/auth/merge-requests/{id}/confirm` | Confirm merge as the target user; unions vocabulary and deletes the source user. |
| `POST` | `/api/auth/logout` | Revoke current session via platform gateway; returns 200 `{"status":"revoked"}` on confirmed revocation or forwards 502/503 (legacy central-auth returns 204). |

### Learning (protected)

Requires `Authorization: Bearer <token>`. All protected routes require a verified email (403 otherwise).

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/words/lookup` | Look up senses for a word. Cache hit returns existing rows. Cache miss + enricher configured returns generated senses, persisted in the same transaction. Cache miss + no enricher returns 503. Optional `source_context` ranks options and sets `similarity`. `force: true` runs Force-Generate (filter + persist additional shared senses). |
| `GET` | `/api/learning-items?limit=50&descending=true&cursor=...&q=app` | List the authenticated user's active learning items. Uses keyset pagination, excludes archived items, supports optional prefix search on `q`, and returns `next_cursor` when more rows are available. |
| `POST` | `/api/learning-items` | Add a `(user, word_sense)` to the authenticated user's learning set. Idempotent. Returns the `user_word_senses` row and its current `due_at`. |
| `GET` | `/api/reviews/due?limit=50` | Return due review items by joining `review_states` to active `user_word_senses`. Respects daily limits (`new_cards_per_day`, `reviews_per_day`), excludes buried and suspended cards, and returns reviews first then new cards. |
| `POST` | `/api/reviews/batch` | Record review attempts and update `review_states` atomically. Applies Anki-style learning/relearning steps, leech detection, sibling-sense burying, and daily count tracking. |
| `POST` | `/api/reviews/optimize-weights` | Trigger FSRS parameter optimization for the authenticated user based on review history (requires 1000+ reviews). Returns 202. |
| `GET` | `/api/reviews/optimization-status` | Return the user's current FSRS weights, last optimization timestamp, and review count. |

## Authentication

Project PN authenticates requests via **in-cluster Keycloak project-scoped access tokens** (`001-gateway-jwt-auth`). Users authenticate at the platform ingress via Traefik ForwardAuth (`gateway.identity.svc`), which injects `Authorization: Bearer <JWT>` upstream to Project PN.

The backend independently validates each Bearer JWT using local JWKS caching (`AUTH_JWT_JWKS_URL`) and strict claim verification (`AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE = project-pn`, non-empty `sub`, `typ = Bearer`, allowed algorithms `RS256`). Unverified client-supplied identity headers (`X-User-*`) are stripped before verification.

`EnsurePlatformUser()` provisions or resolves local users strictly by `(issuer, subject)`:
- Primary key / uniqueness: `UNIQUE (issuer, subject)` on `user_identities`
- Live sign-in method: `google` (reserved: `apple`, `email`)
- Learner privilege: Ordinary access only (no application-administrator product role)
- Email is treated as an informational snapshot; automatic same-email linking is not performed (continuity for existing users is managed via operator migration)


## Production Deployment (Oracle Cloud)

Production runs on **Oracle Cloud k3s** (`project-pn` / `proj-pn` namespace). Images: `ghcr.io/nacfson/project-pn-backend` and `project-pn-frontend`. Public URL: Cursor secret `DEPLOY_PUBLIC_URL`. Runtime secrets are managed through **Cursor environment secrets** and OpenBao in the Kubernetes cluster (`Project_PN` holds no AI API keys). See `backend/docs/cursor-secrets.md` and `backend/docs/oracle-deploy-runbook.md`.

## Enrichment (gloss origin)

On a global cache miss, `POST /api/words/lookup` uses a `WiktApi first => miss => LLM` pipeline:

1. **WiktApi first**: Queries the free **WiktApi** origin (`https://api.wiktapi.dev`) for English→display-language glosses (for example Korean). Each gloss becomes one `word_senses` row and is persisted in Postgres. No WiktApi API key is required. Meanings come from Wiktionary via Kaikki (**CC BY-SA** — credit in product/docs).
2. **Primary LLM on miss**: If `ENRICH_PRIMARY_BASE_URL` is set, `Project_PN` sends `POST {ENRICH_PRIMARY_BASE_URL}/chat/completions` with `ENRICH_PRIMARY_MODEL` (default `gemini-3.1-flash-lite`) only when WiktApi returns no glosses. `Project_PN` does not store or accept AI API keys; OpenBao in the Kubernetes cluster (`vault` namespace) manages the upstream AI API credential. When `ENRICH_PRIMARY_BASE_URL` is unset, `Project_PN` runs WiktApi-only.

- `ORIGIN_WIKTAPI_BASE_URL` (default `https://api.wiktapi.dev`)
- `ENRICH_PRIMARY_BASE_URL` / `ENRICH_PRIMARY_MODEL` (aliases: `ENRICH_BASE_URL`, `ENRICH_MODEL`) — URL + model only LLM enrichment on WiktApi miss

Examples and long dictionary essays are not part of the default gloss path. Multi-word phrases that 404 on public WiktApi fall back to `ENRICH_PRIMARY_BASE_URL` when configured, or return 503 when running WiktApi-only.

## CORS

The API allows browser callers from a configured list of origins. The default list covers the Expo Web dev server and the Tauri desktop WebView:

- `http://localhost:8081` (Expo web dev)
- `http://localhost:19006` (Expo classic web)
- `tauri://localhost` (Tauri macOS)
- `http://tauri.localhost` (Tauri Windows)

Override via the `ALLOWED_ORIGINS` comma-separated env var. Allowed request headers include `Content-Type` and `Authorization`. When no origins are configured, the CORS middleware is not installed and only same-origin requests succeed.

## MVP Boundary

Build only the lean MVP schema until the user explicitly expands scope. The MVP schema is defined in `backend/docs/backend-schema-mvp.md`.

Future expansion tables and rules are defined in `backend/docs/backend-future-scope.md`.

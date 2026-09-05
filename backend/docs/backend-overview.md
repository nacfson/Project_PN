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
| `POST` | `/api/auth/logout` | Revoke current bearer session. 204. |

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

The backend delegates authentication to **central-auth** (`CENTRAL_AUTH_URL`, public host `auth.nacfson.cloud`). Users sign in on the hosted login page with **Google OAuth** (primary) or **magic link** (secondary). The client sends the session token as `Authorization: Bearer <token>` on every API request. The backend validates each token via `CentralClient.ValidateSession()` (`GET /api/auth/session`), which returns `auth_provider` and `identity` (`provider`, `provider_subject`).

`EnsureCentralUser()` provisions or resolves a local `users` row and `user_identities` rows:

- Magic link → `user_identities(provider='nacfson', provider_subject=<central user id>)`
- Google → `user_identities(provider='google', provider_subject=<google sub>)`

When the same email already exists under another provider, the backend returns a **link recommendation** in `GET /api/auth/me` but does **not** auto-insert the identity. The initiator creates `POST /api/auth/link-requests` (15 minute TTL); central-auth sends a magic-link email; the target confirms via `POST /api/auth/link-requests/{id}/confirm` while signed in with the email (`nacfson` / magic_link) session. Different emails require manual merge (`account_merge_requests`). Provider unlink is not supported in v1.

See `backend/docs/account-link-target-approval.md`.

Auth configuration is documented in `backend/docs/go-backend-setup.md`. Flow details are in `backend/docs/backend-flows.md`.

## Production Deployment (Oracle Cloud)

Production runs on **Oracle Cloud k3s** (`project-pn` namespace). Images: `ghcr.io/nacfson/project-pn-backend` and `project-pn-frontend`. Public URL: Cursor secret `DEPLOY_PUBLIC_URL`. Central auth: `https://auth.nacfson.cloud`. Runtime secrets (including `ENRICH_PRIMARY_API_KEY`) are managed through **Cursor environment secrets**. See `backend/docs/cursor-secrets.md` and `backend/docs/oracle-deploy-runbook.md`.

## Enrichment (gloss origin)

On a global cache miss, `POST /api/words/lookup` queries the free **WiktApi** origin (`https://api.wiktapi.dev`) for English→display-language glosses (for example Korean). Each gloss becomes one `word_senses` row and is persisted in Postgres. No WiktApi API key is required. Meanings come from Wiktionary via Kaikki (**CC BY-SA** — credit in product/docs).

Optional: if `ENRICH_PRIMARY_API_KEY` is set, a Gemini/OpenAI-compatible enricher is used only when WiktApi returns no glosses.

- `ORIGIN_WIKTAPI_BASE_URL` (default `https://api.wiktapi.dev`)
- `ENRICH_PRIMARY_API_KEY` / `ENRICH_PRIMARY_BASE_URL` / `ENRICH_PRIMARY_MODEL` — optional legacy fallback
- Legacy `ENRICH_BASE_URL`, `ENRICH_API_KEY`, `ENRICH_MODEL` aliases still apply to the primary fallback slot

Examples and long dictionary essays are not part of the default gloss path. Multi-word phrases may 404 on public WiktApi until covered.

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

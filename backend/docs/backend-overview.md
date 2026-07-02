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
| `GET` | `/api/auth/me` | Current user profile (`email_verified`, languages, etc.). |
| `POST` | `/api/auth/logout` | Revoke current bearer session. 204. |

### Learning (protected)

Requires `Authorization: Bearer <token>`. All protected routes require a verified email (403 otherwise).

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/words/lookup` | Look up senses for a word. Cache hit returns existing rows. Cache miss + enricher configured returns generated senses, persisted in the same transaction. Cache miss + no enricher returns 503. `force: true` runs Force-Generate. |
| `GET` | `/api/learning-items?limit=50&descending=true&cursor=...&q=app` | List the authenticated user's active learning items. Uses keyset pagination, excludes archived items, supports optional prefix search on `q`, and returns `next_cursor` when more rows are available. |
| `POST` | `/api/learning-items` | Add a `(user, word_sense)` to the authenticated user's learning set. Idempotent. Returns the `user_word_senses` row and its current `due_at`. |
| `GET` | `/api/reviews/due?limit=50` | Return due review items by joining `review_states` to active `user_word_senses`. Respects daily limits (`new_cards_per_day`, `reviews_per_day`), excludes buried and suspended cards, and returns reviews first then new cards. |
| `POST` | `/api/reviews/batch` | Record review attempts and update `review_states` atomically. Applies Anki-style learning/relearning steps, leech detection, sibling-sense burying, and daily count tracking. |
| `POST` | `/api/reviews/optimize-weights` | Trigger FSRS parameter optimization for the authenticated user based on review history (requires 1000+ reviews). Returns 202. |
| `GET` | `/api/reviews/optimization-status` | Return the user's current FSRS weights, last optimization timestamp, and review count. |

## Authentication

The backend delegates authentication to an external Nacfson Cloud service (`CENTRAL_AUTH_URL`). The client obtains a session token from `auth.nacfson.cloud`, then sends it as `Authorization: Bearer <token>` on every API request. The backend validates each token by calling the central auth server's `GET /api/auth/session` endpoint via `CentralClient.ValidateSession()`.

On first contact, `EnsureCentralUser()` provisions a local `users` row (with `user_identities` linking) using the identity returned by the central auth server. Subsequent requests resolve the existing local user via `user_identities(provider='nacfson', provider_subject)`.

Auth configuration (`CENTRAL_AUTH_URL`, `CENTRAL_AUTH_INTERNAL_URL`) is documented in `backend/docs/go-backend-setup.md`. Flow details are in `backend/docs/backend-flows.md`.

## Public Docker Deployment

The public deploy path uses Docker Compose on `zlUbuntu`: PostgreSQL, one-shot migrations, the Go API image, and nginx with HTTPS. Forward router ports `80/tcp` and `443/tcp` to `zlUbuntu`, mount real certificates under `deploy/certs/`, and set `APP_PUBLIC_URL` to the public HTTPS domain. The API Docker runtime image includes CA certificates so outbound HTTPS to Resend and enrichment providers works from inside the container.

See `backend/docs/go-backend-setup.md` and `backend/docs/remote-deploy-runbook.md` for deployment steps.

## Enrichment

When the global cache misses, the API can call an OpenAI-compatible chat-completions endpoint to generate canonical target-language definitions, short definitions, CEFR levels, and 3–5 example sentences per sense (spanning difficulty levels). On a cache hit, the same enricher can translate canonical content into an additional display language on demand. The `Enricher` interface (`Enrich` + `Translate`) lives in `backend/internal/enrich/`.

Canonical dictionary text is stored on `word_senses` and `examples`. Localized definitions and example translations are stored in `sense_translations` and `example_translations`, filled lazily per display language and cached permanently when validation passes.

Toggled by environment variables:

- `ENRICH_PRIMARY_BASE_URL` (empty disables primary generation; cache-only lookups still work)
- `ENRICH_PRIMARY_API_KEY`
- `ENRICH_PRIMARY_MODEL`
- `ENRICH_FALLBACK_BASE_URL` (optional fallback base URL tried when primary fails)
- `ENRICH_FALLBACK_API_KEY`
- `ENRICH_FALLBACK_MODEL`
- Legacy `ENRICH_BASE_URL`, `ENRICH_API_KEY`, and `ENRICH_MODEL` remain supported as aliases for the primary slot.

When no primary or legacy base URL is configured, all lookup paths that would need generation return HTTP 503 "word enrichment is not available; configure ENRICH_PRIMARY_BASE_URL or add the sense manually". The current implementation is synchronous and in-request; a background queue (`ai_enrichment_jobs`) is future scope.

For full support across the app's listed target languages (`en`, `ko`, `ja`,
`zh`, `es`, `fr`, `de`), configure a real multilingual OpenAI-compatible
model. The local `english-dictionary-fallback-v1` service is a no-key staging
fallback for English target vocabulary only; it can translate English canonical
content into display languages, but it must not be treated as multilingual
dictionary generation.

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

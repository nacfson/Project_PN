# Backend Overview

## Product Goal

Build a personal vocabulary learning system where users add words they do not know, then study those words through evidence-based methods:

- active recall
- spaced repetition
- contextual examples
- repeated retrieval
- productive use through writing or speaking
- progress tracking based on memory strength, not only streaks

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

### Auth (public, rate limited)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/register` | Create account (email/password). Returns bearer session `{ token, expires_at }`. |
| `POST` | `/api/auth/login` | Email/password login. Returns bearer session. |
| `POST` | `/api/auth/oauth/{provider}` | OAuth login (`google` today). Body: `{ "id_token" }`. Returns bearer session. |
| `POST` | `/api/auth/magic-link` | Request a magic-link email. Always 204 (no email enumeration). |
| `GET` | `/api/auth/magic/consume?token=` | Validate magic token; 302 redirect to `{APP_PUBLIC_URL}/auth/callback#code=...`. |
| `POST` | `/api/auth/magic/exchange` | Exchange one-time callback code for bearer session. Body: `{ "code" }`. |

### Auth (protected)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/auth/me` | Current user profile (`email_verified`, languages, etc.). |
| `POST` | `/api/auth/logout` | Revoke current bearer session. 204. |

### Learning (protected)

Requires `Authorization: Bearer <token>`. When `REQUIRE_EMAIL_VERIFIED=true`, mutating routes also require a verified email (403 otherwise).

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/words/lookup` | Look up senses for a word. Cache hit returns existing rows. Cache miss + enricher configured returns generated senses, persisted in the same transaction. Cache miss + no enricher returns 503. `force: true` runs Force-Generate. |
| `GET` | `/api/learning-items?limit=50&descending=true&cursor=...&q=app` | List the authenticated user's active learning items. Uses keyset pagination, excludes archived items, supports optional prefix search on `q`, and returns `next_cursor` when more rows are available. |
| `POST` | `/api/learning-items` | Add a `(user, word_sense)` to the authenticated user's learning set. Idempotent. Returns the `user_word_senses` row and its current `due_at`. |
| `GET` | `/api/reviews/due?limit=50` | Return due review items by joining `review_states` to active `user_word_senses`. |
| `POST` | `/api/reviews/batch` | Record review attempts and update `review_states` atomically. |

## Authentication

The MVP implements application-layer authentication against the local PostgreSQL `users` table (migration `000003_auth`). Sessions are opaque bearer tokens stored as hashes in `sessions`. Login paths:

- email/password (`register`, `login`)
- Google OAuth (`POST /api/auth/oauth/google`)
- magic link (`magic-link` → email → `magic/consume` → fragment callback → `magic/exchange`)

The acting user is derived from the `Authorization: Bearer` header, not from the request body. Migration `000002_seed_dev_user.up.sql` still seeds a dev user for local fixtures; production-style flows create real users via auth endpoints.

Auth configuration (`SESSION_TTL`, `REQUIRE_EMAIL_VERIFIED`, `EMAIL_PROVIDER`, `APP_PUBLIC_URL`, etc.) is documented in `backend/docs/go-backend-setup.md`. Flow details are in `backend/docs/backend-flows.md`.

## Staging vs production TLS

Private staging deploy (`deploy/`) runs **plain HTTP on port 80** behind nginx. This is intentional for early integration testing only.

**Do not treat staging as production-safe** for passwords, bearer tokens, or magic-link URLs until TLS is enabled in a separate follow-up (domain + certificate mount or Let's Encrypt, public `:443`, HTTP→HTTPS redirect). The API Docker runtime image includes CA certificates so outbound HTTPS to Resend, Google, and enrichment providers works from inside the container even when inbound traffic is HTTP.

See `backend/docs/go-backend-setup.md` for the staging compose stack and `backend/docs/backend-future-scope.md` for the TLS follow-up note.

## Enrichment

When the global cache misses, the API can call an OpenAI-compatible chat-completions endpoint to generate canonical target-language definitions, short definitions, CEFR levels, and 3–5 example sentences per sense (spanning difficulty levels). On a cache hit, the same enricher can translate canonical content into an additional display language on demand. The `Enricher` interface (`Enrich` + `Translate`) lives in `backend/internal/enrich/`.

Canonical dictionary text is stored on `word_senses` and `examples`. Localized definitions and example translations are stored in `sense_translations` and `example_translations`, filled lazily per display language and cached permanently when validation passes.

Toggled by environment variables:

- `ENRICH_BASE_URL` (empty disables generation; cache-only lookups still work)
- `ENRICH_API_KEY`
- `ENRICH_MODEL`

When `ENRICH_BASE_URL` is empty, all lookup paths that would need generation return HTTP 503 "word enrichment is not available; configure ENRICH_BASE_URL or add the sense manually". The current implementation is synchronous and in-request; a background queue (`ai_enrichment_jobs`) is future scope.

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

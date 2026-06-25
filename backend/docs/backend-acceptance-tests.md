# Backend Acceptance Tests

## Schema-Level Scenarios

The backend schema should satisfy these scenarios:

- Same word identity cannot be duplicated globally for the same `(language_code, normalized_text, part_of_speech)`.
- Same user cannot add the same `word_sense` twice.
- Same user can learn two different senses of the same word.
- Two users can have independent schedules for the same `word_sense`.
- A review attempt remains preserved after `review_states` changes.
- Archived user items do not appear in due-review queries.
- Suspended user items (`review_states.is_suspended = true`) do not appear in due-review queries.
- Buried user items (`review_states.buried_until > now()`) do not appear in due-review queries.
- Invalid CEFR values are rejected.
- Invalid learning stages are rejected.
- Invalid review ratings are rejected.
- Invalid confidence ratings are rejected.
- Invalid `difficulty_rating` (out of 1-5) is rejected.
- Negative intervals, review counts, lapse counts, or response times are rejected.
- Invalid FSRS states and negative FSRS stability/difficulty/scheduled step values are rejected.
- Invalid `review_settings.leech_action` values are rejected.
- `review_settings.desired_retention` outside 0.7–0.99 is rejected.
- Duplicate `review_settings` rows for the same user are rejected.
- Duplicate `daily_review_counts` rows for the same (user, date) are rejected.

### Learning step behavior (migration `000009`)

- New card answered "again" enters Learning state with `remaining_steps > 0` and `due_at` within minutes (not days).
- Learning card advancing past the last step graduates to Review state with day-level scheduling.
- Learning card answered "again" resets to the first step.
- Review card answered "again" enters Relearning state with minute-level `due_at` (not +1 day).
- Relearning card graduating returns to Review with recomputed stability.
- `review_settings` is created lazily with defaults on first due-review or batch-review call.
- `daily_review_counts` is upserted on every batch review, incrementing new or review counts.

### Leech, bury, and fuzz behavior

- A card reaching `leech_threshold` lapses with `leech_action = suspend` is archived and `is_suspended = true`.
- A card reaching `leech_threshold` lapses with `leech_action = tag` has `{"leech": true}` in `review_attempts.metadata` and is not suspended.
- After answering a card, sibling senses of the same word have `buried_until` set to end-of-day UTC.
- Interval fuzz (±25%) is applied to intervals >= 2 days when `fuzz_enabled = true`; disabled fuzz produces deterministic intervals.

### FSRS optimization (migration `000010`)

- `review_settings.fsrs_weights` defaults to the 19 FSRS v4 public weights.
- `POST /api/reviews/optimize-weights` with fewer than 1000 reviews returns success with `weights_updated: false`.
- `POST /api/reviews/optimize-weights` with 1000+ reviews returns 202 with `weights_updated: true` and a timestamp.
- `GET /api/reviews/optimization-status` returns the current weights, optimization timestamp, and review count.
- The scheduler uses `review_settings.fsrs_weights` instead of the global default when computing state transitions.

### Deck schema (migration `000015`)

- Each `(user_id, target_language)` has at most one default deck (`decks_user_target_default_unique`).
- Deck names are unique per `(user_id, target_language)` when compared case-insensitively.
- `user_word_senses.deck_id` is non-null after migration.
- Deleting a user cascades to their decks.
- Deleting a custom deck moves its items to the default deck for the same target language.
- The default deck cannot be deleted.

### Auth schema (migration `000003`)

- Duplicate emails differing only by case are rejected (`users_email_lower_idx`).
- Duplicate `sessions.token_hash` is rejected.
- Deleting a `users` row cascades to `sessions`.
- `magic_link_tokens.consumed_at` and `magic_login_exchanges.consumed_at` can be set for single-use redemption tracking.

Use these scenarios when writing migration tests, repository tests, or service-level tests for vocabulary learning behavior.

`internal/migrations/schema_acceptance_test.go` is the canonical Go implementation: it migrates a clean database, exercises each scenario, and asserts the expected reject-or-succeed outcome. `TestAuthSchemaAcceptance` covers the auth-specific cases above.

## HTTP-Layer Scenarios

`internal/http/auth_handler_test.go`, `internal/http/words_handler_test.go`, and `internal/http/router_test.go` cover the HTTP surface:

### Health and CORS

- `GET /healthz` returns 200 regardless of database state.
- `GET /readyz` returns 503 when the database pool is nil; 200 once connected.
- `OPTIONS /api/words/lookup` with a configured `Origin` returns the matching `Access-Control-Allow-Origin` header.

### Auth — protection and sessions

- `POST /api/words/lookup`, `GET /api/learning-items`, `POST /api/learning-items`, and `GET /api/auth/me` return **401** without `Authorization: Bearer`.
- `POST /api/auth/register` then `GET /api/auth/me` with the returned token returns **200** with user profile.
- `POST /api/auth/login` with valid credentials returns **200** `{ token, expires_at }`.

### Auth — rate limits

Public auth routes use `github.com/go-chi/httprate`:

| Route | Limit keys |
|-------|------------|
| `POST /api/auth/register`, `/login`, `/magic-link` | per-IP **and** per-normalized-email (10/min each) |
| `POST /api/auth/oauth/{provider}` | per-IP (10/min) |
| `GET /api/auth/magic/consume`, `POST /api/auth/magic/exchange` | per-IP (20/min) |

Exceeded limits return **429** `{ "error": "too many requests" }`. Auth error bodies stay generic where enumeration is a concern.

### Auth — magic link E2E

- `GET /api/auth/magic/consume?token=` with valid token returns **302** to `{APP_PUBLIC_URL}/auth/callback#code=...` (fragment, not query).
- `POST /api/auth/magic/exchange` with the code returns **200** session token.
- Invalid or expired token/code returns **401**.

### Auth — `REQUIRE_EMAIL_VERIFIED`

- When `REQUIRE_EMAIL_VERIFIED=true`, newly registered (unverified) users get **403** on `POST /api/words/lookup`.
- When `REQUIRE_EMAIL_VERIFIED=false` (default), authenticated lookup is not blocked for verification.

### Auth — Google OAuth (stub verifier)

HTTP tests inject a stub `OAuthVerifier` (production uses `google.golang.org/api/idtoken` with `GOOGLE_CLIENT_IDS`):

- New Google user → **200** session; user has `email_verified_at` set.
- Second login with same `(provider, provider_subject)` → same user id.
- Register password user, then OAuth with matching verified email → identities linked; same user id; password login still works.

### Words (authenticated)

- `POST /api/words/lookup` with empty `text` (and no `word_id`) returns 400.
- `POST /api/words/lookup` with `force: true` and `part_of_speech=Any` (or empty) and no `word_id` returns 400 "force requires a concrete part_of_speech or a word_id".
- `POST /api/words/lookup` with no cache hit and no enricher configured returns 503 "word enrichment is not available; configure ENRICH_BASE_URL or add the sense manually".
- `POST /api/learning-items` with missing or empty `word_sense_id` returns 400.
- `GET /api/learning-items` returns only the authenticated user's active items, excludes archived rows, supports `limit`, `descending`, optional prefix search via `q`, and opaque cursor pagination, and caps `limit` at 100.
- `POST /api/words/lookup` returns 404 when the words service is not wired into the router (dependencies are intentionally minimal in tests).

- `GET /api/reviews/due` returns due active review items with examples and excludes future-scheduled, buried, and suspended items. Reviews are returned before new cards, respecting daily quotas.
- `POST /api/reviews/batch` records attempts and updates `review_states` in one transaction; invalid `activity_type` values return 400 before any attempt is inserted. Applies learning steps, leech detection, sibling bury, and daily count tracking.
- `POST /api/reviews/optimize-weights` triggers FSRS weight optimization; returns 202. Requires 1000+ reviews for actual optimization.
- `GET /api/reviews/optimization-status` returns current FSRS weights, optimization timestamp, and review count.

## Reference

- Schema constraints are defined in `backend/docs/backend-schema-mvp.md`.
- Review behavior and append-only history rules are defined in `backend/docs/learning-review-model.md`.
- Service-level flows (Lookup, Force-Generate, Add-Word, Review) are defined in `backend/docs/backend-flows.md`.
- Environment variables and toggles are listed in `backend/docs/go-backend-setup.md`.

# Backend Acceptance Tests

## Schema-Level Scenarios

The backend schema should satisfy these scenarios:

- Same word identity cannot be duplicated globally for the same `(language_code, normalized_text, part_of_speech)`.
- Same user cannot add the same `word_sense` twice.
- Same user can learn two different senses of the same word.
- Two users can have independent schedules for the same `word_sense`.
- A review attempt remains preserved after `review_states` changes.
- Archived user items do not appear in due-review queries.
- Invalid CEFR values are rejected.
- Invalid learning stages are rejected.
- Invalid review ratings are rejected.
- Invalid confidence ratings are rejected.
- Invalid `difficulty_rating` (out of 1-5) is rejected.
- Negative intervals, review counts, lapse counts, or response times are rejected.

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

When the future `POST /api/reviews` endpoint lands, add HTTP-layer tests for the review transaction (insert attempt + update `review_states` in one transaction, archived item excluded from due count, scheduler updates only `review_states.due_at`).

## Reference

- Schema constraints are defined in `backend/docs/backend-schema-mvp.md`.
- Review behavior and append-only history rules are defined in `backend/docs/learning-review-model.md`.
- Service-level flows (Lookup, Force-Generate, Add-Word, Review) are defined in `backend/docs/backend-flows.md`.
- Environment variables and toggles are listed in `backend/docs/go-backend-setup.md`.

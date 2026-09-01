# Backend Flows

## Central Auth Flow

1. Client opens the Nacfson Cloud login page (`{CENTRAL_AUTH_URL}/login?rd={redirectUrl}`).
2. Nacfson Cloud sends a magic-link email and, after the user opens the link, redirects back to the app with session credentials in the URL (`token`, `refresh_token`, `expires_at` via `?` or `#`).
3. Bearer clients store the full session (`expo-secure-store` on native, `localStorage` on Tauri). Hosted browser web uses the HttpOnly `nacfson_session` cookie instead.
4. Bearer clients send `Authorization: Bearer <token>` on protected API requests. Browser web sends the session cookie with `credentials: include`.
5. Backend middleware validates the session via central auth (`GET /api/auth/session` for bearer, `GET /api/internal/cookie-session` for cookies).
6. Central auth returns identity plus `expires_at`. Cookie validation slides `expires_at` forward on activity when the session is still valid.
7. Bearer clients renew access tokens with `POST /api/auth/refresh` (proxied by Project PN) before expiry or after a 401.
8. Backend calls `EnsureCentralUser()` which provisions or resolves the local user row.
9. `POST /api/auth/logout` revokes the current central session.

See `backend/docs/central-auth-session-renewal.md` for the external auth-service contract.

Password login is not used. Sign-in is magic-link-only on the central auth service.

## Add-Word Flow

1. User submits an unknown word.
2. App normalizes the word text.
3. App creates or reuses a row in `words`.
4. App creates or selects the intended row in `word_senses`.
5. Before committing the personal row, app ensures a valid `sense_translations` row exists for the requested `display_language_code` when it differs from the word's target language. On-demand Translate is best-effort per sense: extra or missing example translations no longer abort the whole word. If the enricher is unconfigured or the provider rejects the request, add returns HTTP 503 with that cause. If Translate ran but this sense still has no valid display-language definition, the add is rejected with HTTP 422.
6. App resolves the target deck. If the request includes `deck_id`, it validates ownership and that the deck's `target_language` matches the word's `language_code`. Otherwise it uses the active target language's default deck, creating the default deck if necessary.
7. App upserts a row in `user_word_senses` with the chosen `deck_id`.
8. App creates one `review_states` row if missing.
9. App may attach sense-specific examples.

Steps 6-8 must be idempotent: re-adding the same `(user_id, word_sense_id)` must not fail, and the `review_states` row must be created with `ON CONFLICT (user_word_sense_id) DO UPDATE SET updated_at = now()` semantics so a second call does not reset the schedule.

## Learning Items List Flow

1. Client sends `GET /api/learning-items?limit=50&descending=true&cursor=...&q=app&language_code=...&deck_id=...`.
2. API derives the acting user from the bearer session.
3. API resolves the target language. If `language_code` is omitted, the active `user_languages` row is used.
4. If `deck_id` is provided, API validates deck ownership and resolves the target language from the deck.
5. API queries `user_word_senses` joined to `word_senses`, `words`, `decks`, and `review_states`, filtering to the resolved target language and deck.
6. API excludes rows where `user_word_senses.archived_at is not null`.
7. If `q` is present, API normalizes it and filters with `words.normalized_text like q || '%'`.
8. API orders by `user_word_senses.added_at` plus `id` as a stable tie-breaker.
9. API loads example sentences and their translations for each returned item when present.
10. API returns up to `limit` items and an opaque `next_cursor` when another page exists.

Rules:

- `limit` defaults to 50 and is capped at 100.
- `descending` defaults to `true`; `false` returns oldest first.
- `q` is optional prefix search. It must be applied in SQL, not by loading the full user list into application memory.
- Use keyset pagination, not offset pagination.
- Do not return `total_count` in MVP.

## Lookup Flow (cache miss → WiktApi glosses → persist)

This is the `POST /api/words/lookup` happy path when the global cache has no row for the lookup key:

1. App normalizes the lookup text.
2. App resolves the target/display language pair (request or active `user_languages`).
3. App queries `words` by `(language_code, normalized_text[, part_of_speech])`. On a cache hit, load senses and left-join `sense_translations` for the display language.
4. On a hit with missing display-language translations, app may call the enricher's `Translate` (WiktApi re-query) and upsert `sense_translations`.
5. On a full miss, app calls the configured enricher. Default is **WiktApi** (`ORIGIN_WIKTAPI_BASE_URL`, no API key): `GET /v1/en/word/{lemma}/translations`, keep display-language glosses (e.g. `ko`), map each gloss to one sense (no examples required).
6. In one transaction, upsert `words` and `appendSenses` (canonical text + display gloss in `sense_translations`).
7. Return sense options for **Select Words** (lemma → list of glosses). Optional `source_context` still re-ranks options.

If WiktApi has no entry and no legacy Gemini fallback is configured, lookup returns HTTP 503. Multi-word phrases may miss on public WiktApi.

## Force-Generate Flow (none of these match)

This is the `POST /api/words/lookup` path with `force: true`:

1. Require `force: true` plus `word_id` or a concrete `part_of_speech`.
2. Load existing sense definitions and ask the enricher for additional glosses (WiktApi skips glosses already present).
3. Append new senses and return them.

## Change-Meaning Flow

`PATCH /api/learning-items/{id}` with body `{ "word_sense_id": "...", "display_language_code": "..." }`:

1. Load the learning item by `id` + authenticated `user_id` (404 if missing).
2. Verify the new sense exists and belongs to the same `word_id` as the current sense (422 otherwise).
3. Ensure display-language translations as on add.
4. If another **active** card already has `(user_id, new_word_sense_id)`, return HTTP 409 `sense_already_in_learning_set`.
5. Update `user_word_senses.word_sense_id` only. Do **not** modify `review_states`.

## Archive Learning Item Flow

1. Client sends `DELETE /api/learning-items/{id}` or `POST /api/learning-items/archive` with `{ "item_ids": ["..."] }`.
2. API sets `user_word_senses.archived_at` and `learning_stage = 'archived'` for the user's active rows.
3. Archived items are excluded from `GET /api/learning-items`, due-review queries, and deck item counts.
4. Re-adding the same `(user_id, word_sense_id)` via `POST /api/learning-items` clears `archived_at` and restores the card (idempotent).

## Retranslate-Senses Command

One-shot CLI (`go run ./cmd/retranslate-senses`) rebuilds selected `words` rows with WiktApi glosses (optional Gemini/OpenAI only when `ENRICH_PRIMARY_API_KEY` is set, as fallback):

1. Enrich with empty `Existing` (fresh distinct senses / KO glosses from public WiktApi).
2. Insert new senses, auto-match each learner card via token Jaccard on definition + localized gloss, resolve conflicts (higher `review_count`, else earlier `added_at`; archive losers), then delete old sense IDs.
3. Scope which lemmas to process:
   - `-user-id UUID` or `-email` — only words in that user's **active** learning set (`user_word_senses.archived_at is null`). Global sense rebuild still runs for those lemmas (shared dictionary).
   - `-word-id UUID` — single word.
   - neither — all `words` rows (admin catalog rebuild).
4. Other flags: `-limit N`, `-dry-run` (preview AutoMatch old→new without writing), `-continue-on-error`.

Example (account refresh):

```bash
cd backend && set -a && source .env && set +a
go run ./cmd/retranslate-senses -email 'you@example.com' -dry-run
go run ./cmd/retranslate-senses -email 'you@example.com' -continue-on-error
```

## Review Flow

1. App resolves the active target language from `user_languages` (or from the explicit `language_code` query parameter). If `deck_id` is provided, it validates ownership and uses the deck's target language. It queries due items by joining `review_states` to `user_word_senses`, `words`, and `decks`, filtering to the resolved target language and deck.
2. App loads or creates the user's `review_settings` (lazily, with defaults).
3. App loads today's `daily_review_counts` for the user.
4. App excludes rows where `user_word_senses.archived_at is not null`, `review_states.is_suspended = true`, or `review_states.buried_until > now()`.
5. App returns unfinished intra-day Learning/Relearning items first (no daily quota, including cards whose step interval has not elapsed yet), then Review items (up to `reviews_per_day - reviews_done`), then New items (up to `new_cards_per_day - new_cards_done`). This recovers a failed-word retry queue if the user exits or refreshes mid-session.
6. User answers a prompt.
7. App loads the user's `review_settings` and builds a `SchedulerConfig` (learning steps, relearning steps, desired retention, fuzz, FSRS weights).
8. App calls `CalculateNextFSRSState` with the config, which applies Anki-style step logic:
   - New + again/hard → Learning state, scheduled in minutes (learning_steps).
   - Learning → advances or resets steps; graduates to Review when exhausted.
   - Review + again → Relearning state, scheduled in minutes (relearning_steps).
   - Relearning → advances or resets steps; graduates to Review when exhausted.
   - Review + hard/good/easy → day-level FSRS scheduling with optional fuzz.
9. App inserts a row in `review_attempts` (with `metadata` including leech flag if applicable).
10. App updates `review_states` (due_at, interval_days, ease_factor, last_reviewed_at, review_count, lapse_count, fsrs_state, stability, difficulty, scheduled_days, remaining_steps, is_suspended) in the same transaction.
11. App upserts `daily_review_counts`, incrementing `new_cards_done` or `reviews_done` based on the card's previous state.
12. App checks leech condition: if `lapse_count >= leech_threshold` and `leech_action = suspend`, archives the card and sets `is_suspended = true`.
13. App buries other senses of the same word: sets `buried_until = end_of_today_utc` on all sibling `user_word_senses` sharing the same `word_id`.
14. App may update `user_word_senses.learning_stage`, but scheduling must still come from `review_states.due_at`.

The Go API exposes due-review reads through `GET /api/reviews/due` and batch attempt writes through `POST /api/reviews/batch`. The batch endpoint inserts attempts and updates review state in one transaction.

## FSRS Weight Optimization Flow

1. Client calls `POST /api/reviews/optimize-weights`.
2. API counts the user's `review_attempts`. If fewer than 1000, returns success with `weights_updated: false`.
3. API loads the user's review history (stability, difficulty, elapsed days, correctness) from `review_attempts` joined to `review_states`.
4. API runs gradient descent on the first 8 FSRS weights to minimize log-likelihood loss between predicted retrievability and actual outcomes.
5. API saves optimized weights to `review_settings.fsrs_weights` with a timestamp.
6. Subsequent reviews use the optimized weights via `SchedulerConfig`.

The optimization status can be checked via `GET /api/reviews/optimization-status`.

## HTTP Mapping

| HTTP route | Flow | Service / handler |
|------------|------|-------------------|
| `GET /api/auth/language-options` | Language options | `auth.Service.LanguageOptions` |
| `GET /api/auth/me` | Current user | context user |
| `POST /api/auth/logout` | Logout | `auth.Service.Logout` |
| `GET /api/user/languages` | List user language pairs | `auth.Service.GetUserLanguages` |
| `POST /api/user/languages` | Add user language pair | `auth.Service.AddUserLanguage` |
| `PATCH /api/user/languages/{target_language}` | Update display language | `auth.Service.UpdateUserLanguageDisplayLang` |
| `PATCH /api/user/languages/{target_language}/active` | Set active language | `auth.Service.SetActiveUserLanguage` |
| `DELETE /api/user/languages/{target_language}` | Remove user language pair | `auth.Service.RemoveUserLanguage` |
| `GET /api/user/ui-language` | Get UI language | `auth.Service.GetUILanguage` |
| `PUT /api/user/ui-language` | Set UI language | `auth.Service.SetUILanguage` |
| `GET /api/decks` | List decks | `words.Service.ListDecks` |
| `POST /api/decks` | Create deck | `words.Service.CreateDeck` |
| `PATCH /api/decks/{deck_id}` | Rename deck | `words.Service.RenameDeck` |
| `DELETE /api/decks/{deck_id}` | Delete deck | `words.Service.DeleteDeck` |
| `POST /api/decks/{deck_id}/move-items` | Move items to deck | `words.Service.MoveItemsToDeck` |
| `POST /api/words/lookup` (no `force`) | Lookup | `words.Service.Lookup` |
| `POST /api/words/lookup` (`force: true`) | Force-Generate | `words.Service.ForceGenerate` |
| `GET /api/learning-items` | Learning Items List | `words.Service.ListLearningItems` |
| `POST /api/learning-items` | Add-Word (steps 5-6); accepts optional `source_context` | `words.Service.AddLearningItem` |
| `DELETE /api/learning-items/{id}` | Archive one learning item (remove from deck) | `words.Service.ArchiveLearningItems` |
| `POST /api/learning-items/archive` | Batch archive `{ item_ids }` | `words.Service.ArchiveLearningItems` |
| `PATCH /api/learning-items/{id}` | Change meaning (swap `word_sense_id`, keep schedule) | `words.Service.ChangeLearningItemSense` |
| `GET /api/reviews/due` | Due Review List | `words.Service.GetDueReviewItems` |
| `POST /api/reviews/batch` | Review | `words.Service.RecordBatchReviewAttempts` |
| `POST /api/reviews/optimize-weights` | FSRS Weight Optimization | `words.Service.OptimizeWeights` |
| `GET /api/reviews/optimization-status` | Optimization Status | `words.Service.GetOptimizationStatus` |
| `GET /healthz` | liveness | n/a |
| `GET /readyz` | readiness (DB ping) | n/a |

Protected learning routes run `authMiddleware` then `requireVerified` when `REQUIRE_EMAIL_VERIFIED=true` (403 if email not verified).

## Flow Rules

- Normalize user input before inserting or looking up a word.
- `review_states.due_at` determines when an item appears again. Intra-day Learning/Relearning cards are also returned while still in step progression so interrupted retries are recovered.
- `review_attempts` remains append-only even when `review_states` changes.
- Archived, suspended, and buried user items must not appear in due-review queries.
- Daily quotas (`new_cards_per_day`, `reviews_per_day`) are enforced by the due-review query using `daily_review_counts`. Unfinished Learning/Relearning retries are exempt from those quotas.
- Learning and relearning steps use minute-level `due_at` until the card graduates to Review.
- Leech cards (lapse_count >= threshold) are suspended or tagged per `review_settings.leech_action`.
- Sibling senses of the same word are buried until end-of-day after one is reviewed.
- Interval fuzz (±25%) is applied to day-level intervals >= 2 when `fuzz_enabled` is true.
- FSRS weights can be optimized per user after 1000+ reviews via `POST /api/reviews/optimize-weights`.
- The Add-Word and Review transactions are atomic: any failure rolls back the attempt insert together with the `review_states` update.
- Full table definitions live in `backend/docs/backend-schema-mvp.md`.
- Learning and scheduling policy details live in `backend/docs/learning-review-model.md`.
- Go service code lives under `backend/internal/words/service.go`, `backend/internal/words/scheduler.go`, `backend/internal/words/batch_reviews.go`, `backend/internal/words/fsrs_optimizer.go`, and `backend/internal/auth/`.

# Backend Flows

## Platform Gateway JWT Auth Flow (001-gateway-jwt-auth)

1. Client accesses the app at `https://pn.nacfson.cloud`.
2. Unauthenticated requests are intercepted by platform Traefik ForwardAuth (`forward-auth.platform` calling `http://gateway.identity.svc:8080/auth`).
3. Gateway redirects browser to Keycloak platform realm Google broker (`https://auth.nacfson.cloud/realms/platform`).
4. On successful Google sign-in, gateway issues a session cookie (`.nacfson.cloud`) and mints a project-scoped access token (`aud = project-pn`).
5. Traefik ForwardAuth injects `Authorization: Bearer <JWT>` and strips client-supplied headers before proxying upstream to `pn-backend`.
6. Non-web clients (native, desktop, extension) attach `Authorization: Bearer <project_access_jwt>` directly.
7. Backend `authMiddleware` validates JWT signature and claims via in-cluster JWKS (`AUTH_JWT_JWKS_URL`), enforcing `aud = project-pn`, exact `iss`, `sub`, and `typ = Bearer`.
8. `EnsurePlatformUser()` resolves local `users` row strictly by `(issuer, subject)` binding with ordinary learner privileges only.
9. Token refresh is managed directly by platform Keycloak / gateway; legacy `POST /api/auth/refresh` returns 410 Gone.
10. See `backend/docs/platform-identity-migration.md` for the operator continuity and cutover runbook.


## Integrated Accounts

- Provider: `google` (Google OAuth).
- Same verified email: automatically bound on Google sign-in.
- Different emails, same domain: soft merge hint in Settings; manual merge via `POST /api/auth/merge-requests` + confirm (target user logged in).
- Word lists are unioned on merge; duplicate `(user, word_sense)` rows keep the target account schedule.

## Add-Word Flow

1. User submits an unknown word.
2. App normalizes the word text.
3. App creates or reuses a row in `words`.
4. App creates or selects the intended row in `word_senses`.
5. Before committing the personal row, app ensures a valid `sense_translations` row exists for the requested `display_language_code` when it differs from the word's target language. On-demand Translate is best-effort per sense: extra or missing example translations no longer abort the whole word. If the enricher is unconfigured or the provider rejects the request, add returns HTTP 503 with that cause. If Translate ran but this sense still has no valid display-language definition, the add is rejected with HTTP 422.
6. App resolves the target deck. If the request includes `deck_id`, it validates ownership and that the deck's `target_language` matches the word's `language_code`. Otherwise it uses the active target language's default deck, creating the default deck if necessary.
7. App upserts a row in `user_word_senses` with the chosen `deck_id`. Optional `source_context` (provenance) and `personal_note` (display override) may be stored. On conflict re-add, empty/omitted `personal_note` keeps the existing note (same coalesce pattern as `source_context`).
8. App creates one `review_states` row if missing.
9. App may attach sense-specific examples.

`POST /api/learning-items` body: `{ "word_sense_id", "display_language_code", "deck_id?", "source_context?", "personal_note?" }`. `word_sense_id` remains required. `personal_note` is personal display-only; it never writes to `word_senses` / `sense_translations`. List and due payloads include `personal_note` so clients can prefer it over catalog glosses.

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
6. In one transaction, upsert `words`, run `FilterProperSenses` on each entry (same criteria as Force-Generate step 4: simple display-language gloss uniqueness vs existing catalog text and others in the batch), then `appendSenses` for survivors (canonical text + display gloss in `sense_translations`). Entries that filter to empty are skipped; if every entry is empty, return no senses (do not leave empty `words` rows from this miss). Words enriched before this filter may still show duplicate-looking cards until cleaned or force-regenerated.
7. Return sense options for **Select Words** (lemma → list of glosses). Optional `source_context` re-ranks options by token Jaccard (definition + localized gloss, excluding the lemma and English stopwords so headword restatements do not dominate) and sets `similarity` on each option. Stored `meaning_order` is unchanged.

If WiktApi has no entry and no legacy Gemini fallback is configured, lookup returns HTTP 503 for **single-word** lemmas. Multi-word phrases usually miss on public WiktApi; when an LLM key is configured, **phrase lookups try the LLM first**, then WiktApi, using phrase-specific gloss rules. If both fail (or no LLM key is set), lookup **creates a draft `phrase` sense** so the learner can still add the expression to a private deck via `user_word_senses`; better shared senses can be force-generated later when enrichment is available. Phrases are stored as normal `words` rows (`normalized_text` keeps spaces, e.g. `in which`) with `part_of_speech = 'phrase'` (enrichment/persist coerce multi-word lemmas away from noun/verb tags). Manual add and passage phrase-mode can submit multi-word lemmas the same way as single words.

## Force-Generate Flow (none of these match)

This is the `POST /api/words/lookup` path with `force: true` (Select Words / Change Meaning “find more”):

1. Require `force: true` plus `word_id` or a concrete `part_of_speech`.
2. Load existing sense definitions (for the LLM `Existing` list) and display-language gloss texts (for the propriety filter).
3. Ask the enricher for additional glosses. WiktApi skips glosses already present. If WiktApi has nothing new it returns `ErrUnavailable`, and the Gemini/OpenAI fallback runs when `ENRICH_PRIMARY_API_KEY` is set. The LLM is steered by `source_context` and must not emit near-synonym pairs.
4. Run `FilterProperSenses` on the new batch: drop empty rows, missing display-language glosses, long paraphrases that are not a simple gloss, and near-duplicates (token Jaccard ≥ 0.8 vs existing catalog text or others in the batch).
5. If the filter empties the batch, return HTTP 503 `no additional distinct sense` (do not re-return the same list as success).
6. Append survivors as shared `word_senses` / `sense_translations` and return the refreshed options, re-ranked when `source_context` is set.

If no LLM key is configured and WiktApi has nothing new, force returns HTTP 503 (same enrichment-unavailable family). Typed / `personal_note` glosses are not accepted on this path.

## Change-Meaning Flow

`PATCH /api/learning-items/{id}` with body `{ "word_sense_id": "...", "display_language_code": "...", "personal_note?": "..." }`:

1. Load the learning item by `id` + authenticated `user_id` (404 if missing).
2. Verify the new sense exists and belongs to the same `word_id` as the current sense (422 otherwise).
3. Ensure display-language translations as on add.
4. If another **active** card already has `(user_id, new_word_sense_id)`, return HTTP 409 `sense_already_in_learning_set`.
5. Update `user_word_senses.word_sense_id`. Do **not** modify `review_states`.
6. `personal_note` policy:
   - Sense **swap** with note omitted → clear `personal_note` (old wording belonged to the previous sense).
   - Sense swap with non-empty note → set the new note.
   - Sense swap with `""` (or JSON null treated as clear when provided as empty string) → clear.
   - **Same** `word_sense_id` with a provided note → note-only update (no 409; schedule unchanged).
   - Same sense with note omitted → no-op.

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
5. App returns unfinished intra-day Learning/Relearning items first (no daily quota, including cards whose step interval has not elapsed yet), then Review items (up to `reviews_per_day - reviews_done`), then New items (up to `new_cards_per_day - new_cards_done`). This recovers a failed-word retry queue if the user exits or refreshes mid-session. Within the review-like group and the new-card group, items are shuffled and then interleaved by `word_id` so origin/add order cannot be memorized.
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
12. App checks leech condition: if `lapse_count >= leech_threshold`, marks the attempt metadata with leech and sets `leech`/`is_leech` on the batch update. Only when `leech_action = suspend` does it also archive the card and set `is_suspended = true`. Default `tag` leaves the card in the due queue.
13. App buries other senses of the same word: sets `buried_until = end_of_today_utc` on all sibling `user_word_senses` sharing the same `word_id`.
14. App may update `user_word_senses.learning_stage`, but scheduling must still come from `review_states.due_at`.

`PATCH /api/learning-items/{id}` may set `word_sense_id` (catalog sense swap; does not reset FSRS) and/or `personal_note` (personal display gloss only on `user_word_senses`). Typed manual text must never be inserted into global `word_senses` / `sense_translations`. Changing `personal_note` emits a learning-log `personal_meaning_set` event. Flashcards prefer a non-empty `personal_note` over the catalog gloss.

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
| `POST /api/learning-items` | Add-Word (steps 5-6); optional `source_context`, `personal_note` | `words.Service.AddLearningItem` |
| `DELETE /api/learning-items/{id}` | Archive one learning item (remove from deck) | `words.Service.ArchiveLearningItems` |
| `POST /api/learning-items/archive` | Batch archive `{ item_ids }` | `words.Service.ArchiveLearningItems` |
| `PATCH /api/learning-items/{id}` | Change meaning (swap `word_sense_id` and/or update `personal_note`, keep schedule) | `words.Service.ChangeLearningItemSense` |
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
- Leech cards (`lapse_count >= threshold`) stay in Practice by default (`leech_action = tag`) with an `is_leech` flag for UI. Optional `suspend` still archives.
- Sibling senses of the same word are buried until end-of-day after one is reviewed.
- Interval fuzz (±25%) is applied to day-level intervals >= 2 when `fuzz_enabled` is true.
- FSRS weights can be optimized per user after 1000+ reviews via `POST /api/reviews/optimize-weights`.
- The Add-Word and Review transactions are atomic: any failure rolls back the attempt insert together with the `review_states` update.
- Full table definitions live in `backend/docs/backend-schema-mvp.md`.
- Learning and scheduling policy details live in `backend/docs/learning-review-model.md`.
- Go service code lives under `backend/internal/words/service.go`, `backend/internal/words/scheduler.go`, `backend/internal/words/batch_reviews.go`, `backend/internal/words/fsrs_optimizer.go`, and `backend/internal/auth/`.

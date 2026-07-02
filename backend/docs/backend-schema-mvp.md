# Backend MVP Schema

## Scope

Build only these tables for the first version:

```text
users
user_identities
words
word_senses
user_word_senses
review_states
review_attempts
examples
```

This supports:

- adding unknown words
- storing definitions and examples
- learning multiple senses of the same word independently
- reviewing due learning items
- active recall
- spaced repetition
- tracking review history

## PostgreSQL Setup

```sql
create extension if not exists pgcrypto;
```

Every table should use:

```sql
id uuid primary key default gen_random_uuid()
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Use an application-side `updated_at` update or a shared database trigger later. Do not duplicate trigger logic in every migration unless the project standardizes on that pattern.

Constraint names follow the pattern `<table>_<rule>_<kind>` (for example `words_identity_unique`, `word_senses_cefr_valid`).

## SQL Migration File Organization

Migration files are chronological, not domain-separated.

Required structure:

```text
backend/db/migrations/
- 000001_init_mvp_schema.up.sql
- 000001_init_mvp_schema.down.sql
- 000002_seed_dev_user.up.sql
- 000002_seed_dev_user.down.sql
- 000003_auth.up.sql
- 000003_auth.down.sql
- 000004_learning_items_list_index.up.sql
- 000004_learning_items_list_index.down.sql
- 000005_words_prefix_search.up.sql
- 000005_words_prefix_search.down.sql
```

Rules:

- All `up` and `down` migrations live under `backend/db/migrations/`.
- Migrations are applied in lexicographic order by `golang-migrate`.
- Do not create domain SQL source files such as `words.sql`, `reviews.sql`, or `auth.sql` as the executable migration source.
- When a change belongs to a domain, encode that in the migration name, for example `000004_learning_items_list_index.up.sql`.
- Every new `*.up.sql` migration must have a matching `*.down.sql` rollback migration.
- Keep domain explanations in `backend/docs/*.md`; keep executable database changes in numbered migration files.

A second migration, `000002_seed_dev_user.up.sql`, inserts a single dev user (id `00000000-0000-0000-0000-000000000001`) for local fixtures. It is not part of the schema shape; treat it as runtime data.

Migration `000003_auth.up.sql` adds authentication columns and tables below.

## users

Stores app users.

```sql
users
- id uuid primary key default gen_random_uuid()
- email text not null
- native_language text not null
- target_language text not null
- ui_language text not null default 'en'
- email_verified_at timestamptz
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
```

Required index (replaces the original case-sensitive `users_email_key` unique constraint from `000001`):

```sql
create unique index users_email_lower_idx on users (lower(email));
```

Rules:

- `email` uniqueness is case-insensitive via `users_email_lower_idx`. Application code normalizes with `strings.ToLower(strings.TrimSpace(email))` on every store/match.
- `native_language` and `target_language` are legacy defaults kept for backward compatibility. New code should read the active pair from `user_languages`.
- `ui_language` is the app interface language, independent from learning content.
- `native_language` and `target_language` should use stable language codes such as `ko`, `en`, or `ja`.
- `email_verified_at` is set to `now()` by central auth user JIT provisioning. Used by email verification gating.

## user_languages

Stores every target/display language pair a user is learning. One row per user is marked active and drives lookups, learning lists, reviews, and word-of-the-day.

```sql
user_languages
- user_id uuid not null references users(id) on delete cascade
- target_language text not null
- display_language text not null
- is_active boolean not null default false
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
```

Required constraints and indexes:

```sql
constraint user_languages_pk primary key (user_id, target_language)
create unique index user_languages_active_unique on user_languages (user_id) where is_active = true;
create index user_languages_user_id_idx on user_languages (user_id);
```

Rules:

- `target_language` is the language of the words being learned (e.g., `en`, `zh`).
- `display_language` is the language used for definitions and example translations (e.g., `ko`, `en`). It is not required to be the user's native/first language.
- Exactly one row per user should have `is_active = true`. The application manages this through transactions that deactivate the old active row before activating a new one; the partial unique index enforces it at the database level.
- A user cannot add the same `target_language` twice. To support multiple display languages for the same target later, widen the primary key to `(user_id, target_language, display_language)`.
- Deleting a `users` row cascades and deletes associated `user_languages` rows.

## decks

Stores user-created named groups of vocabulary items, scoped to a target language. Each `user_word_senses` row belongs to exactly one deck.

```sql
decks
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references users(id) on delete cascade
- target_language text not null
- name text not null
- is_default boolean not null default false
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
```

Required constraints and indexes:

```sql
constraint decks_user_target_name_unique
  unique (user_id, target_language, lower(name))
create unique index decks_user_target_default_unique
  on decks (user_id, target_language) where is_default = true;
create index decks_user_id_idx on decks (user_id);
create index decks_user_target_idx on decks (user_id, target_language);
```

Rules:

- A deck belongs to one user and one target language.
- Exactly one default deck exists per `(user_id, target_language)`. The application creates it lazily.
- The default deck receives items when no other deck is specified.
- Deleting a custom deck moves its items to the default deck for the same target language; the default deck itself cannot be deleted.

## user_identities

Links external OAuth providers to app users.

```sql
user_identities
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references users(id) on delete cascade
- provider text not null
- provider_subject text not null
- email_at_provider text
- created_at timestamptz not null default now()
```

Required constraints and indexes:

```sql
constraint user_identities_provider_subject_unique unique (provider, provider_subject)
create index user_identities_user_id_idx on user_identities (user_id)
```

Rules:

- `provider` values include `nacfson` (central auth).
- Account linking to an existing user happens when central auth verifies the email and the normalized emails match.


## words

Stores global word-level information.

```sql
words
- id uuid primary key default gen_random_uuid()
- language_code text not null
- lemma text not null
- normalized_text text not null
- part_of_speech text not null
- pronunciation text
- audio_url text
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
```

Required constraint:

```sql
constraint words_identity_unique
  unique (language_code, normalized_text, part_of_speech)
```

Example:

```text
lemma: analyze
normalized_text: analyze
part_of_speech: verb
language_code: en
```

Rules:

- `words` is global dictionary data.
- Do not store user progress, mastery, due dates, confidence, or notes on this table.
- Normalize user input before inserting or looking up a word.
- `part_of_speech` is intentionally unenforced at the DB level. The vocabulary comes from an LLM enricher that may emit `noun`, `verb`, `adjective`, `adverb`, `pronoun`, `preposition`, `conjunction`, `interjection`, `determiner`, etc. Persist whatever the enricher returns, lowercased.
- `language_code` is free text but should be a stable ISO 639-1 code such as `en`, `ko`, or `ja`. There is no DB-level format check by design.

## word_senses

Stores meanings of a word.

One word can have multiple meanings, so definitions should not be stored only on the `words` table.

```sql
word_senses
- id uuid primary key default gen_random_uuid()
- word_id uuid not null references words(id) on delete cascade
- definition text not null
- short_definition text
- cefr_level text
- meaning_order integer not null
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
```

Recommended constraints:

```sql
constraint word_senses_order_unique
  unique (word_id, meaning_order)
constraint word_senses_meaning_order_positive
  check (meaning_order > 0)
constraint word_senses_cefr_valid
  check (cefr_level is null or cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
```

Example:

```text
word: charge
sense 1: to ask someone to pay an amount of money
sense 2: to accuse someone officially of a crime
sense 3: to store electrical energy in a device
```

Rules:

- Senses are global dictionary data written in the word's target `language_code` (canonical definitions).
- A user can learn any number of senses for the same word.
- Review state must not be stored here because memory belongs to the user.
- Per-display-language definitions live in `sense_translations`, filled on demand and cached.

## sense_translations

Stores localized definitions for a word sense in the learner's display language.

```sql
sense_translations
- id uuid primary key default gen_random_uuid()
- word_sense_id uuid not null references word_senses(id) on delete cascade
- language_code text not null
- definition text not null
- short_definition text
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
```

Recommended constraints:

```sql
constraint sense_translations_unique
  unique (word_sense_id, language_code)
```

Rules:

- `language_code` is the learner/native/display language (for example `ko`, `ja`).
- Rows are created lazily when a lookup or add flow requests a display language different from the word's target language.
- Validated translations are cached permanently; failed translations are not stored.

## user_word_senses

Stores the relationship between a user and a specific word sense they are learning.

This is the central user-learning table.

```sql
user_word_senses
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references users(id) on delete cascade
- word_sense_id uuid not null references word_senses(id) on delete cascade
- deck_id uuid not null references decks(id) on delete restrict
- learning_stage text not null default 'new'
- source_context text
- personal_note text
- difficulty_rating integer
- added_at timestamptz not null default now()
- archived_at timestamptz
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
```

Required constraints:

```sql
constraint user_word_senses_user_sense_unique
  unique (user_id, word_sense_id)
constraint user_word_senses_deck_id_fk
  foreign key (deck_id) references decks(id) on delete restrict
constraint user_word_senses_learning_stage_valid
  check (learning_stage in ('new', 'learning', 'recognized', 'recalled', 'usable', 'mastered', 'archived'))
constraint user_word_senses_difficulty_valid
  check (difficulty_rating is null or difficulty_rating between 1 and 5)
```

Rules:

- This replaces the earlier `user_words` table.
- The same user cannot add the same `word_sense` twice.
- The same user can learn two different senses of the same word.
- Different users can learn the same `word_sense` with independent notes, stages, and schedules.
- Every item belongs to exactly one `decks` row. New items are placed in the active target language's default deck unless the caller specifies a custom deck.
- `learning_stage` is a high-level capability label, not the scheduling source of truth.
- `archived_at` should be set when the user no longer wants the item in active review.
- Active user list queries should use a partial index on `(user_id, added_at desc, id desc) where archived_at is null`.
- Learning-item prefix search should filter through `words.normalized_text like $query || '%'` and use a B-tree `text_pattern_ops` index.

## review_states

Stores spaced repetition scheduling data.

There must be one row per `user_word_senses` row.

```sql
review_states
- id uuid primary key default gen_random_uuid()
- user_word_sense_id uuid not null references user_word_senses(id) on delete cascade
- due_at timestamptz not null default now()
- interval_days integer not null default 0
- ease_factor numeric(4,2) not null default 2.50
- last_reviewed_at timestamptz
- review_count integer not null default 0
- lapse_count integer not null default 0
- fsrs_state text not null default 'New'
- stability double precision not null default 0
- difficulty double precision not null default 0
- scheduled_days integer not null default 0
- remaining_steps integer not null default 0
- buried_until timestamptz
- is_suspended boolean not null default false
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
```

Required constraints:

```sql
constraint review_states_user_word_sense_unique
  unique (user_word_sense_id)
constraint review_states_interval_nonnegative
  check (interval_days >= 0)
constraint review_states_ease_factor_minimum
  check (ease_factor >= 1.00)
constraint review_states_review_count_nonnegative
  check (review_count >= 0)
constraint review_states_lapse_count_nonnegative
  check (lapse_count >= 0)
constraint review_states_fsrs_state_valid
  check (fsrs_state in ('New', 'Learning', 'Review', 'Relearning'))
constraint review_states_stability_nonnegative
  check (stability >= 0)
constraint review_states_difficulty_nonnegative
  check (difficulty >= 0)
constraint review_states_scheduled_days_nonnegative
  check (scheduled_days >= 0)
constraint review_states_remaining_steps_nonnegative
  check (remaining_steps >= 0)
```

Rules:

- `due_at` is the source of truth for scheduling.
- A due-review query should join `review_states` to `user_word_senses` and exclude archived, suspended, and buried items.
- The scheduler uses an FSRS-style DSR memory state: `difficulty`, `stability`, `fsrs_state`, and `scheduled_days`.
- `remaining_steps` tracks the position in the current learning/relearning step progression. When > 0, the card is in an intra-day step phase.
- `buried_until` temporarily hides a card (e.g., sibling senses of the same word) until the end of the current UTC day. The due query excludes cards where `buried_until > now()`.
- `is_suspended` permanently hides a card (e.g., leech suspension). Suspended cards are also archived on `user_word_senses`.
- `interval_days` and `ease_factor` are retained as legacy compatibility fields and are updated from the FSRS result; they are not the scheduler source of truth.
- The `user_word_senses.difficulty_rating` column (1-5) is the user's subjective rating, not the FSRS scheduler `difficulty` parameter. Do not confuse the two.

## review_settings

Stores per-user scheduling configuration (Anki deck-level equivalent).

```sql
review_settings
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references users(id) on delete cascade
- new_cards_per_day integer not null default 20
- reviews_per_day integer not null default 200
- learning_steps integer[] not null default '{1,10}'       -- minutes
- relearning_steps integer[] not null default '{10}'        -- minutes
- leech_threshold integer not null default 8
- leech_action text not null default 'suspend'              -- 'suspend' | 'tag'
- fuzz_enabled boolean not null default true
- desired_retention double precision not null default 0.90
- fsrs_weights double precision[] not null default '{...}'  -- 19 FSRS v4 weights
- weights_optimized_at timestamptz
- weights_review_count integer not null default 0
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
```

Required constraints:

```sql
constraint review_settings_user_unique unique (user_id)
constraint review_settings_leech_action_valid check (leech_action in ('suspend', 'tag'))
constraint review_settings_desired_retention_valid check (desired_retention between 0.7 and 0.99)
constraint review_settings_new_cards_positive check (new_cards_per_day >= 0)
constraint review_settings_reviews_positive check (reviews_per_day >= 0)
constraint review_settings_leech_threshold_positive check (leech_threshold >= 1)
```

Rules:

- One row per user, created lazily with defaults on first due-review or batch-review call.
- `learning_steps` and `relearning_steps` are arrays of minutes defining the intra-day step progression for new and lapsed cards.
- `fsrs_weights` contains the 19 FSRS v4 weights used by the scheduler. Defaults match the public FSRS v4 model. Can be optimized per user via `POST /api/reviews/optimize-weights`.
- `weights_optimized_at` and `weights_review_count` track optimization status.

## daily_review_counts

Tracks per-user per-day review counts for daily quota enforcement.

```sql
daily_review_counts
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references users(id) on delete cascade
- review_date date not null
- new_cards_done integer not null default 0
- reviews_done integer not null default 0
```

Required constraints:

```sql
constraint daily_review_counts_user_date_unique unique (user_id, review_date)
```

Rules:

- One row per (user, date). Created lazily on first review of the day.
- `new_cards_done` increments when a card in `New` state is reviewed.
- `reviews_done` increments when a card in `Review` or `Relearning` state is reviewed.
- The due-review query subtracts these counts from `review_settings` quotas to determine how many more cards to show.

## review_attempts

Stores every learning attempt.

This table is append-only history. Do not overwrite previous attempts when review state changes.

```sql
review_attempts
- id uuid primary key default gen_random_uuid()
- user_word_sense_id uuid not null references user_word_senses(id) on delete cascade
- activity_type text not null
- prompt text
- user_answer text
- correct_answer text
- is_correct boolean
- review_rating text
- response_time_ms integer
- confidence_rating integer
- metadata jsonb not null default '{}'::jsonb
- reviewed_at timestamptz not null default now()
- created_at timestamptz not null default now()
```

Recommended constraints:

```sql
constraint review_attempts_activity_type_valid
  check (activity_type in (
    'word_to_meaning',
    'meaning_to_word',
    'cloze',
    'multiple_choice',
    'typing',
    'speaking',
    'writing',
    'sentence_creation'
  ))
constraint review_attempts_review_rating_valid
  check (review_rating is null or review_rating in ('again', 'hard', 'good', 'easy'))
constraint review_attempts_response_time_nonnegative
  check (response_time_ms is null or response_time_ms >= 0)
constraint review_attempts_confidence_rating_valid
  check (confidence_rating is null or confidence_rating between 1 and 5)
```

Example:

```text
activity_type: cloze
prompt: Scientists need to _____ the results carefully.
correct_answer: analyze
user_answer: analysis
is_correct: false
review_rating: again
```

Rules:

- Insert one row for every answer.
- Store scheduler-facing grades in `review_rating`.
- Use `metadata` for structured activity payloads such as multiple-choice options, cloze spans, evaluator version, or AI grading details.
- Update `review_states` in the same transaction after inserting a review attempt.

## examples

Stores example sentences for a specific word sense.

```sql
examples
- id uuid primary key default gen_random_uuid()
- word_sense_id uuid not null references word_senses(id) on delete cascade
- sentence text not null
- source text
- difficulty_level text
- cloze_text text
- cloze_answer text
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
```

Recommended constraints:

```sql
constraint examples_difficulty_level_valid
  check (difficulty_level is null or difficulty_level in ('easy', 'medium', 'hard'))
```

Rules:

- Examples should be sense-specific, not only word-specific.
- Example sentences are stored once in the word's target language.
- Localized sentence translations (with optional `**...**` highlight markers) live in `example_translations`.
- `cloze_text` and `cloze_answer` are optional MVP fields for fill-in-the-blank exercises.

## example_translations

Stores localized translations for example sentences.

```sql
example_translations
- id uuid primary key default gen_random_uuid()
- example_id uuid not null references examples(id) on delete cascade
- language_code text not null
- translation text not null
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
```

Recommended constraints:

```sql
constraint example_translations_unique
  unique (example_id, language_code)
```

Rules:

- `language_code` is the learner/native/display language.
- Translations may include inline `**...**` markers highlighting the target word's meaning.
- Rows are created lazily alongside `sense_translations` for the same display language.

## Suggested Relationships

```text
users 1 -> many user_identities
users 1 -> many user_languages
users 1 -> many decks
users 1 -> 1 review_settings
users 1 -> many daily_review_counts
users 1 -> many user_word_senses
decks 1 -> many user_word_senses
words 1 -> many word_senses
word_senses 1 -> many user_word_senses
word_senses 1 -> many sense_translations
word_senses 1 -> many examples
examples 1 -> many example_translations
user_word_senses 1 -> 1 review_states
user_word_senses 1 -> many review_attempts
```

## Indexes

These indexes are required for the documented query patterns (due-review, per-user-sense attempt history, sense-level example lookups, active learning-item lists, prefix search, daily quota, and review settings):

```sql
create index review_states_due_at_idx
  on review_states (due_at);

create index review_attempts_user_word_sense_reviewed_at_idx
  on review_attempts (user_word_sense_id, reviewed_at desc);

create index examples_word_sense_id_idx
  on examples (word_sense_id);

create index sense_translations_sense_lang_idx
  on sense_translations (word_sense_id, language_code);

create index example_translations_example_lang_idx
  on example_translations (example_id, language_code);

create index user_word_senses_active_user_added_idx
  on user_word_senses (user_id, added_at desc, id desc)
  where archived_at is null;

create index words_normalized_text_prefix_idx
  on words (normalized_text text_pattern_ops);

create index review_settings_user_id_idx
  on review_settings (user_id);

create index daily_review_counts_user_date_idx
  on daily_review_counts (user_id, review_date);

create index decks_user_id_idx
  on decks (user_id);

create index decks_user_target_idx
  on decks (user_id, target_language);

create index user_word_senses_deck_id_idx
  on user_word_senses (deck_id);
```

- `review_states_due_at_idx` powers the due-review query that filters on `due_at <= now()`.
- `review_attempts_user_word_sense_reviewed_at_idx` powers the per-item history read in `reviewed_at desc` order.
- `examples_word_sense_id_idx` powers the sense-level example join used by the lookup response.
- `sense_translations_sense_lang_idx` powers localized definition joins for lookup and learning-item lists.
- `example_translations_example_lang_idx` powers localized example translation joins.
- `user_word_senses_active_user_added_idx` powers cursor pagination for the authenticated user's active learning list.
- `words_normalized_text_prefix_idx` powers prefix search for normalized vocabulary text without adding a new PostgreSQL extension.
- `review_settings_user_id_idx` powers the per-user settings lookup used by the due query and batch review flow.
- `daily_review_counts_user_date_idx` powers the daily quota check in the due-review query.
- `decks_user_id_idx` and `decks_user_target_idx` power deck listing by user and target language.
- `user_word_senses_deck_id_idx` powers deck-scoped learning list and due-review queries.

## Open / Unenforced Fields

A small set of fields are intentionally left unenforced at the DB level so the LLM enricher can drive their content:

| Field | Reason |
|-------|--------|
| `words.part_of_speech` | Enricher emits one entry per POS; the project keeps the set open. Lowercase on persist. |
| `words.language_code` | Free text by design. Treat as ISO 639-1 in application code. |
| `user_word_senses.personal_note`, `source_context` | Free-form user text. |

The above do not have a check constraint. Do not add one without first freezing the enricher's output contract.

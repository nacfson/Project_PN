# Backend MVP Schema

## Scope

Build only these tables for the first version:

```text
users
sessions
user_identities
magic_link_tokens
magic_login_exchanges
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
- password_hash text
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
- `native_language` and `target_language` should use stable language codes such as `ko`, `en`, or `ja`.
- `password_hash` is bcrypt for password accounts; null for OAuth-only users until they set a password.
- `email_verified_at` is set when the user proves email ownership (magic-link consume, Google OAuth with verified email, etc.). Used by `REQUIRE_EMAIL_VERIFIED` gating.

## sessions

Opaque bearer sessions for authenticated API access.

```sql
sessions
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references users(id) on delete cascade
- token_hash text not null
- expires_at timestamptz not null
- created_at timestamptz not null default now()
```

Required constraints and indexes:

```sql
constraint sessions_token_hash_unique unique (token_hash)
create index sessions_user_id_idx on sessions (user_id)
create index sessions_expires_at_idx on sessions (expires_at)
```

Rules:

- Plaintext tokens are never stored; only a hash is persisted.
- Expired sessions are rejected on `Authenticate`; lazy cleanup may delete expired rows.
- `Logout` deletes the current session row only.

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

- `provider` values include `google` today.
- Account linking to an existing password user happens only when OAuth reports `emailVerified == true` and the normalized emails match.

## magic_link_tokens

Single-use email login tokens.

```sql
magic_link_tokens
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references users(id) on delete cascade
- token_hash text not null
- expires_at timestamptz not null
- consumed_at timestamptz
- created_at timestamptz not null default now()
```

Required constraints and indexes:

```sql
constraint magic_link_tokens_token_hash_unique unique (token_hash)
create index magic_link_tokens_user_id_idx on magic_link_tokens (user_id)
create index magic_link_tokens_expires_at_idx on magic_link_tokens (expires_at)
```

Rules:

- `consumed_at` is set when the token is redeemed via `GET /api/auth/magic/consume`.
- Consumption also sets `users.email_verified_at` when previously null.

## magic_login_exchanges

Short-lived exchange codes handed to the frontend callback (fragment `#code=`) after magic-link consume.

```sql
magic_login_exchanges
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references users(id) on delete cascade
- code_hash text not null
- expires_at timestamptz not null
- consumed_at timestamptz
- created_at timestamptz not null default now()
```

Required constraints and indexes:

```sql
constraint magic_login_exchanges_code_hash_unique unique (code_hash)
create index magic_login_exchanges_user_id_idx on magic_login_exchanges (user_id)
create index magic_login_exchanges_expires_at_idx on magic_login_exchanges (expires_at)
```

Rules:

- Single-use: `POST /api/auth/magic/exchange` sets `consumed_at` and mints a bearer session.
- Prefer fragment delivery (`#code=`) so the code is not sent to nginx access logs; see `backend/docs/backend-flows.md`.

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
- definition_language_code text not null
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
  unique (word_id, definition_language_code, meaning_order)
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

- Senses are global dictionary data.
- A user can learn any number of senses for the same word.
- Review state must not be stored here because memory belongs to the user.

## user_word_senses

Stores the relationship between a user and a specific word sense they are learning.

This is the central user-learning table.

```sql
user_word_senses
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references users(id) on delete cascade
- word_sense_id uuid not null references word_senses(id) on delete cascade
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
```

Rules:

- `due_at` is the source of truth for scheduling.
- A due-review query should join `review_states` to `user_word_senses` and exclude archived items.
- The MVP scheduler is SM-2-flavored: `ease_factor`, `interval_days`, `review_count`, `lapse_count`. FSRS-style `stability` and item-level scheduler `difficulty` are not in MVP.
- The `user_word_senses.difficulty_rating` column (1-5) is the user's subjective rating, not the scheduler's difficulty parameter. Do not confuse the two.

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
- translation text
- translation_language_code text
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
- `translation_language_code` identifies the language of `translation`.
- `cloze_text` and `cloze_answer` are optional MVP fields for fill-in-the-blank exercises.

## Suggested Relationships

```text
users 1 -> many sessions
users 1 -> many user_identities
users 1 -> many magic_link_tokens
users 1 -> many magic_login_exchanges
users 1 -> many user_word_senses
words 1 -> many word_senses
word_senses 1 -> many user_word_senses
word_senses 1 -> many examples
user_word_senses 1 -> 1 review_states
user_word_senses 1 -> many review_attempts
```

## Indexes

These indexes are required for the documented query patterns (due-review, per-user-sense attempt history, sense-level example lookups, active learning-item lists, and prefix search):

```sql
create index review_states_due_at_idx
  on review_states (due_at);

create index review_attempts_user_word_sense_reviewed_at_idx
  on review_attempts (user_word_sense_id, reviewed_at desc);

create index examples_word_sense_id_idx
  on examples (word_sense_id);

create index user_word_senses_active_user_added_idx
  on user_word_senses (user_id, added_at desc, id desc)
  where archived_at is null;

create index words_normalized_text_prefix_idx
  on words (normalized_text text_pattern_ops);
```

- `review_states_due_at_idx` powers the due-review query that filters on `due_at <= now()`.
- `review_attempts_user_word_sense_reviewed_at_idx` powers the per-item history read in `reviewed_at desc` order.
- `examples_word_sense_id_idx` powers the sense-level example join used by the lookup response.
- `user_word_senses_active_user_added_idx` powers cursor pagination for the authenticated user's active learning list.
- `words_normalized_text_prefix_idx` powers prefix search for normalized vocabulary text without adding a new PostgreSQL extension.

## Open / Unenforced Fields

A small set of fields are intentionally left unenforced at the DB level so the LLM enricher can drive their content:

| Field | Reason |
|-------|--------|
| `words.part_of_speech` | Enricher emits one entry per POS; the project keeps the set open. Lowercase on persist. |
| `words.language_code` | Free text by design. Treat as ISO 639-1 in application code. |
| `word_senses.definition_language_code` | Same as `words.language_code`. |
| `user_word_senses.personal_note`, `source_context` | Free-form user text. |

The above do not have a check constraint. Do not add one without first freezing the enricher's output contract.

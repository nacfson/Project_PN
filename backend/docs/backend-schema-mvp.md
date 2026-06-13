# Backend MVP Schema

## Scope

Build only these tables for the first version:

```text
users
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

## users

Stores app users.

```sql
users
- id uuid primary key default gen_random_uuid()
- email text not null unique
- native_language text not null
- target_language text not null
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
```

Rules:

- `email` must be unique.
- `native_language` and `target_language` should use stable language codes such as `ko`, `en`, or `ja`.
- Password/session data should not be stored here unless the backend explicitly implements local auth later.

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
unique (word_id, definition_language_code, meaning_order)
check (meaning_order > 0)
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
unique (user_id, word_sense_id)
check (learning_stage in ('new', 'learning', 'recognized', 'recalled', 'usable', 'mastered', 'archived'))
check (difficulty_rating is null or difficulty_rating between 1 and 5)
```

Rules:

- This replaces the earlier `user_words` table.
- The same user cannot add the same `word_sense` twice.
- The same user can learn two different senses of the same word.
- Different users can learn the same `word_sense` with independent notes, stages, and schedules.
- `learning_stage` is a high-level capability label, not the scheduling source of truth.
- `archived_at` should be set when the user no longer wants the item in active review.

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
unique (user_word_sense_id)
check (interval_days >= 0)
check (ease_factor >= 1.00)
check (review_count >= 0)
check (lapse_count >= 0)
```

Rules:

- `due_at` is the source of truth for scheduling.
- A due-review query should join `review_states` to `user_word_senses` and exclude archived items.
- Future smarter scheduling can add `stability` and `difficulty`, but the MVP should not require them.

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
check (review_rating is null or review_rating in ('again', 'hard', 'good', 'easy'))
check (response_time_ms is null or response_time_ms >= 0)
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
check (difficulty_level is null or difficulty_level in ('easy', 'medium', 'hard'))
```

Rules:

- Examples should be sense-specific, not only word-specific.
- `translation_language_code` identifies the language of `translation`.
- `cloze_text` and `cloze_answer` are optional MVP fields for fill-in-the-blank exercises.

## Suggested Relationships

```text
users 1 -> many user_word_senses
words 1 -> many word_senses
word_senses 1 -> many user_word_senses
word_senses 1 -> many examples
user_word_senses 1 -> 1 review_states
user_word_senses 1 -> many review_attempts
```

# Backend Flows

## Add-Word Flow

1. User submits an unknown word.
2. App normalizes the word text.
3. App creates or reuses a row in `words`.
4. App creates or selects the intended row in `word_senses`.
5. App upserts a row in `user_word_senses`.
6. App creates one `review_states` row if missing.
7. App may attach sense-specific examples.

## Review Flow

1. App queries due items by joining `review_states` to `user_word_senses`.
2. App excludes rows where `user_word_senses.archived_at is not null`.
3. User answers a prompt.
4. App inserts a row in `review_attempts`.
5. App updates `review_states.due_at`, `interval_days`, `ease_factor`, `last_reviewed_at`, `review_count`, and `lapse_count` in the same transaction.
6. App may update `user_word_senses.learning_stage`, but scheduling must still come from `review_states.due_at`.

## Flow Rules

- Normalize user input before inserting or looking up a word.
- `review_states.due_at` determines when an item appears again.
- `review_attempts` remains append-only even when `review_states` changes.
- Archived user items must not appear in due-review queries.
- Full table definitions live in `backend/docs/backend-schema-mvp.md`.
- Learning and scheduling policy details live in `backend/docs/learning-review-model.md`.

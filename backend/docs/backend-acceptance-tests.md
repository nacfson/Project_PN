# Backend Acceptance Tests

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
- Negative intervals, review counts, lapse counts, or response times are rejected.

Use these scenarios when writing migration tests, repository tests, or service-level tests for vocabulary learning behavior.

Schema constraints are defined in `backend/docs/backend-schema-mvp.md`. Review behavior and append-only history rules are defined in `backend/docs/learning-review-model.md`.

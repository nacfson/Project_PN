# Learning Review Model

## Learning Unit

The learnable unit is `user_word_senses`: a user's relationship to a specific `word_senses` row.

Do not store a user's mastery level directly on global dictionary tables.

Wrong:

```text
words.mastery_level
word_senses.mastery_level
```

Correct:

```text
user_word_senses.learning_stage
review_states.due_at
review_attempts.is_correct
review_attempts.review_rating
```

Mastery belongs to the user, not to the word or the global sense.

## Learning Stages

`user_word_senses.learning_stage` is a high-level capability label, not the scheduling source of truth.

Possible values:

```text
new
learning
recognized
recalled
usable
mastered
archived
```

Meaning:

- `new`: the user added the sense but has not studied it yet
- `learning`: the user is reviewing it
- `recognized`: the user can recognize the sense when seeing the word
- `recalled`: the user can remember the meaning without seeing the answer
- `usable`: the user can use the word sense in writing or speaking
- `mastered`: the sense has strong long-term retention
- `archived`: the user no longer wants to study it

## Scheduling Rules

`review_states.due_at` is the source of truth for scheduling.

Do not make `learning_stage` the scheduling source of truth.

Wrong:

```text
learning_stage = mastered, therefore hide forever
```

Correct:

```text
review_states.due_at determines when the item appears again
learning_stage describes the user's broad ability level
```

There must be one `review_states` row per `user_word_senses` row. A due-review query should join `review_states` to `user_word_senses` and exclude archived items.

Future smarter scheduling can add `stability` and `difficulty`, but the MVP should not require them.

## Review Attempts

`review_attempts` stores every learning attempt and is append-only history. Do not overwrite previous attempts when review state changes.

Rules:

- Insert one row for every answer.
- Store scheduler-facing grades in `review_rating`.
- Use `metadata` for structured activity payloads such as multiple-choice options, cloze spans, evaluator version, or AI grading details.
- Update `review_states` in the same transaction after inserting a review attempt.

Example:

```text
activity_type: cloze
prompt: Scientists need to _____ the results carefully.
correct_answer: analyze
user_answer: analysis
is_correct: false
review_rating: again
```

## Evidence-Based Data Model

The schema supports evidence-based learning because it stores:

- which exact word sense the user is learning
- whether the user successfully retrieved the answer
- when the user reviewed it
- how long the user took to answer
- how confident the user felt
- how many times the user failed
- when the sense should appear again
- whether the user can recognize, recall, and use the sense

The key tables for this are:

```text
user_word_senses
review_states
review_attempts
```

Full table definitions live in `backend/docs/backend-schema-mvp.md`.

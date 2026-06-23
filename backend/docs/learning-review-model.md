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

There must be one `review_states` row per `user_word_senses` row. A due-review query should join `review_states` to `user_word_senses` and exclude archived, suspended, and buried items.

The scheduler is FSRS-style and stores a DSR memory state on `review_states`:

```text
fsrs_state
stability
difficulty
scheduled_days
remaining_steps
```

`interval_days` and `ease_factor` remain as legacy compatibility fields and may be updated from the FSRS result, but they are not the scheduling source of truth. The `user_word_senses.difficulty_rating` column (1-5) is the user's subjective rating, not the FSRS scheduler's `difficulty` parameter. Do not confuse the two.

## Learning & Relearning Steps

The scheduler implements Anki-style intra-day learning and relearning steps. New and lapsed cards go through short step progressions (measured in minutes) before graduating to day-level FSRS scheduling.

### Learning Steps (New Cards)

When a new card is answered "again" or "hard", it enters the `Learning` state and progresses through `review_settings.learning_steps` (default: `[1, 10]` minutes).

- "again" resets the card to the first step.
- "hard" / "good" / "easy" advance the card one step.
- When all steps are exhausted, the card graduates to `Review` state with day-level FSRS scheduling.
- "good" or "easy" on a brand-new card graduates it directly to `Review`, skipping steps.

### Relearning Steps (Lapsed Cards)

When a `Review` card is answered "again", it lapses and enters the `Relearning` state, progressing through `review_settings.relearning_steps` (default: `[10]` minutes).

- "again" resets to the first relearning step.
- Other ratings advance one step.
- When all steps are exhausted, the card returns to `Review` state with stability recomputed via the forget-stability formula.

### Step State

`review_states.remaining_steps` tracks how many steps remain in the current learning/relearning progression. When `remaining_steps > 0`, the card is in an intra-day step phase and `due_at` is set minutes in the future, not days.

## Daily Limits

The due-review query respects per-user daily quotas configured in `review_settings`:

- `new_cards_per_day` (default: 20): maximum new cards introduced per day.
- `reviews_per_day` (default: 200): maximum review cards (Review/Relearning state) per day.

`daily_review_counts` tracks how many new cards and reviews the user has already done today. The due query returns reviews first (Anki convention), then new cards up to their remaining quota.

## Interval Fuzzing

When `review_settings.fuzz_enabled` is true (default), the scheduler applies ±25% random fuzz to intervals of 2 days or more. This prevents reviews from clustering on the same day. Fuzz is disabled in tests for deterministic interval assertions.

## Leech Detection

A card that lapses `review_settings.leech_threshold` times (default: 8) is flagged as a leech.

- If `leech_action` is `suspend` (default): the card is suspended (`review_states.is_suspended = true`) and archived (`user_word_senses.archived_at = now()`). It will no longer appear in due-review queries.
- If `leech_action` is `tag`: the attempt's `metadata` is marked with `{"leech": true}` but the card is not suspended.

## Bury (Same-Word Sense Suppression)

After a card is answered, all other `user_word_senses` for the same user that share the same `word_id` (other senses of the same word) have their `review_states.buried_until` set to the end of the current UTC day. The due query excludes cards where `buried_until > now()`. This ensures only one sense of a word is reviewed per day, matching Anki's "bury until tomorrow" behavior for sibling cards.

## FSRS Parameter Optimization

The scheduler uses 19 FSRS weights that can be optimized per user. By default, the public FSRS v4 default weights are used. After a user accumulates at least 1000 review attempts, weights can be optimized via `POST /api/reviews/optimize-weights`.

The optimization runs gradient descent on the user's review history to minimize log-likelihood loss between predicted retrievability (from the forgetting curve) and actual recall outcomes. Optimized weights are stored in `review_settings.fsrs_weights` with a timestamp.

The optimization status can be checked via `GET /api/reviews/optimization-status`.

## Review Settings

Per-user scheduling configuration is stored in `review_settings`:

```text
new_cards_per_day
reviews_per_day
learning_steps       -- minutes, default {1, 10}
relearning_steps     -- minutes, default {10}
leech_threshold      -- default 8
leech_action         -- 'suspend' | 'tag'
fuzz_enabled         -- default true
desired_retention    -- default 0.90
fsrs_weights         -- 19 doubles, defaults to FSRS v4
weights_optimized_at
weights_review_count
```

Settings rows are created lazily with defaults on first due-review or batch-review call for a user.

## Review Attempts

`review_attempts` stores every learning attempt and is append-only history. Do not overwrite previous attempts when review state changes.

Rules:

- Insert one row for every answer.
- Store scheduler-facing grades in `review_rating`.
- Use `metadata` for structured activity payloads such as multiple-choice options, cloze spans, evaluator version, AI grading details, or leech flags.
- Update `review_states` in the same transaction after inserting a review attempt.

The full add-attempt + update-state transaction is described in `backend/docs/backend-flows.md` under "Review Flow".

Example:

```text
activity_type: cloze
prompt: Scientists need to _____ the results carefully.
correct_answer: analyze
user_answer: analysis
is_correct: false
review_rating: again
metadata: {"leech": true}
```

## Practice Activity Types

`review_attempts.activity_type` records the kind of exercise the user performed. The frontend currently uses three types:

- `meaning_to_word`: the user sees a definition and recalls the target word.
- `cloze`: the user sees an example sentence with the target word blanked out and recalls the word.
- `word_to_meaning`: the user taps to reveal a flashcard and self-grades recognition.

The scheduler treats all three the same way: it uses the user's self-rated `rating_score` (0.0–3.0) to compute the next FSRS state. The activity type is kept for analytics and future per-mode difficulty tuning.

### Mixed Mode Policy

Normal and repeat sessions mix typing (productive recall) with flashcard (recognition) based on the item's `learning_stage`:

| Stage | Flashcard probability |
|-------|----------------------|
| `new`, `learning` | 0% |
| `recognized` | 50% |
| `recalled` | 70% |
| `usable` | 85% |
| `mastered` | 95% |

Flashcards become the dominant mode as a word matures, while typing remains the default for brand-new cards to strengthen productive recall.

### Repeat Review Mode

Repeat mode loads every non-archived `user_word_senses` row via `GET /api/learning-items` and presents them for extra practice. Because the list endpoint now includes example sentences, repeat-mode cards can use the same `cloze` prompts as normal due reviews.

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
review_settings
daily_review_counts
```

Full table definitions live in `backend/docs/backend-schema-mvp.md`.

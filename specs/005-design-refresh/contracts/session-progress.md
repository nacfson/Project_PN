# Contract: Session Progress

**Owner module**: `frontend/src/features/practice/practiceItemState.ts`
**Consumer**: `frontend/src/features/practice/PracticeScreen.tsx` (progress bar and "X of N" counter)
**Spec**: FR-015a, FR-015b, FR-015c, SC-012

## Interface

```ts
export const PASSING_SCORE_THRESHOLD = 0.75;

/** Single source of truth for "correct" (FR-015c). */
export function isPassingScore(score: number): boolean; // score >= PASSING_SCORE_THRESHOLD

export interface SessionProgressInput {
  /** Attempts recorded this session, in order. Existing ReviewAttemptParams shape. */
  attempts: ReadonlyArray<Pick<ReviewAttemptParams, 'user_word_sense_id' | 'is_correct'>>;
  /** user_word_sense_id of every due item loaded at session start. Fixed for the session. */
  dueIds: ReadonlyArray<string>;
}

export interface SessionProgress {
  completed: number; // distinct dueIds with ≥1 attempt where is_correct === true
  total: number;     // max(distinct dueIds count, 1)
  current: number;   // min(completed + 1, total)
  percent: number;   // floor(completed / total * 100), 0–100
}

export function sessionProgress(input: SessionProgressInput): SessionProgress;
```

## Behavioral rules

1. Only attempts whose id is in `dueIds` and whose `is_correct === true` contribute.
2. Each id contributes at most once, regardless of how many correct attempts it has.
3. Forgot (`is_correct === false`) never contributes.
4. Duplicate ids in `dueIds` are de-duplicated before computing `total`.
5. The function is pure: no I/O, no mutation of its inputs, and deterministic.
6. For any append-only sequence of attempts, `completed` is non-decreasing.

## Integration rules (PracticeScreen)

- `attempt.is_correct = isPassingScore(finalScore)`. The value is unchanged from today, because `again 0, hard 1, good 2, easy 3` gives the same result as `>= 0.75`.
- `shouldRetry = !isPassingScore(finalScore)` replaces the inline `< 0.75`.
- The progress bar uses `percent`. The counter text uses `t('practice.cardProgress', { current, total })`.
- The same function is used in normal and repeat sessions.
- `practiceCardProgress()` and the inline `dueItemsReviewedCount` are removed.
- The `review_attempts` payload sent to the server is unchanged (constitution II, FR-038).

## Test vectors (MUST be encoded in `practiceItemState.test.ts`)

`F` = Forgot (`is_correct: false`), `C` = Hard/Good/Easy (`is_correct: true`). The due ids are `a…p` (16) unless stated.

| # | Case | dueIds | attempts | completed | current | total | percent |
|---|---|---|---|---|---|---|---|
| 1 | Session start | a–p | — | 0 | 1 | 16 | 0 |
| 2 | Three correct first try | a–p | aC bC cC | 3 | 4 | 16 | 18 |
| 3 | Forgot does not advance | a–p | aC bC cC dF | 3 | 4 | 16 | 18 |
| 4 | Fail then correct counts once | a–p | aC bC cC dF eC dC | 5 | 6 | 16 | 31 |
| 5 | Repeated fails | a–p | aF aF aF | 0 | 1 | 16 | 0 |
| 6 | Correct twice counts once (repeat mode) | a–p | aC aC | 1 | 2 | 16 | 6 |
| 7 | Attempts outside dueIds ignored | a–c | aC zC | 1 | 2 | 3 | 33 |
| 8 | All correct reaches 100 | a–p | each of a–p C once, with d,h,k,n F first | 16 | 16 | 16 | 100 |
| 9 | Not 100 while a failure is pending | a–p | a–o C, pF | 15 | 16 | 16 | 93 |
| 10 | Empty session | — | — | 0 | 1 | 1 | 0 |
| 11 | Duplicate dueIds | a, a, b | aC | 1 | 2 | 2 | 50 |

Vector 8 is the SC-012 scenario: a 16-card session where 4 cards fail once. Progress advances in exactly 16 single-card steps, never on Forgot, and reaches 100 only on the final correct answer.

Additional tests:
- `isPassingScore`: 0 → false; 1, 2, 3 → true.
- A component test: rating Forgot leaves the counter text unchanged, and the next correct rating of a new card advances it by one.

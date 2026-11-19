# Practice Feature

## Overview
Implements the spaced-repetition practice session experience, including normal due-review and endless repeat sessions, 3D animated flashcards with swipe grading, typing/flashcard reveal flows, batched review attempt syncing, retry interleaving, leech handling with in-session meaning edits, and pure session-state helpers.

## Interface
- `Flashcard({ item, example, blankedSentence, isFlipped, cardMode, userAnswer, isPreviouslyFailed, onFlip, onRate?, maxHeight? })` `[Flashcard.tsx:Flashcard]` — Animated two-sided review card supporting tap-to-flip, horizontal swipe-to-rate (`again` left / `good` right once flipped), inner scrolling for long glosses or capped heights, TTS audio via `SpeakButton`, and retry/leech badges.
- `PracticeScreen()` `[PracticeScreen.tsx:PracticeScreen]` — Main Practice tab screen managing session lifecycle (`idle`, `loading_due`, `loading_repeat`, `active`, `submitting`, `success`, `error`), deck-scoped private due/repeat loading, queued batch review syncing, keyboard shortcuts, focus-mode shell chrome hiding, and stuck-word meaning updates via `ChangeMeaningSheet`.
- `mapScoreToQuality(score)` `[PracticeScreen.tsx:mapScoreToQuality]` — Maps numeric rating scores (`< 1.0` -> `score * 3.0`, otherwise `3.0 + (score - 1.0)`) to quality values.
- `dueItemToListItem(item)` `[PracticeScreen.tsx:dueItemToListItem]` — Converts a `DueItem` to a `LearningItemListItem` for `ChangeMeaningSheet`.
- `failedMapFromDueItems(items)` `[PracticeScreen.tsx:failedMapFromDueItems]` — Seeds the retrying-card lookup map with items currently in `learning_stage === 'learning'`.
- `decideCardMode(item)` `[PracticeScreen.tsx:decideCardMode]` — Chooses `'flashcard'` or `'typing'` mode for a due item (currently configured with probability `1` for `'flashcard'` across all stages).
- `PASSING_SCORE_THRESHOLD` (`0.75`) `[practiceItemState.ts:PASSING_SCORE_THRESHOLD]` and `isPassingScore(score)` `[practiceItemState.ts:isPassingScore]` — Single source of truth for whether a rating score counts as correct (`score >= 0.75`).
- `sessionProgress(input)` `[practiceItemState.ts:sessionProgress]`, `SessionProgressInput` `[practiceItemState.ts:SessionProgressInput]`, `SessionProgress` `[practiceItemState.ts:SessionProgress]` — Computes distinct completed due IDs, total (minimum `1`), current position, and floored completion percentage.
- `formatStepMinutes(minutes)` `[practiceItemState.ts:formatStepMinutes]` and `learningPreviewFromSteps(steps)` `[practiceItemState.ts:learningPreviewFromSteps]` — Formats learning-step intervals (`m` / `h`) into an `IntervalPreview`.
- `optimisticDueItemAfterAgain(item, settings?)` `[practiceItemState.ts:optimisticDueItemAfterAgain]` — Produces an optimistic `'learning'` stage snapshot with learning-step preview intervals (defaulting to `[1, 10]`) immediately after an `'again'` grade.
- `mergeDueItemUpdate(item, update)` `[practiceItemState.ts:mergeDueItemUpdate]`, `applyDueItemUpdatesToList(items, updates, options?)` `[practiceItemState.ts:applyDueItemUpdatesToList]`, `overridesFromBatchUpdates(updates)` `[practiceItemState.ts:overridesFromBatchUpdates]`, `resolveDueItem(item, overrides)` `[practiceItemState.ts:resolveDueItem]` — Applies server batch review updates and local overrides while pruning future copies of suspended items without invalidating already-graded queue indexes.
- `shufflePracticeQueue(items, random?)` `[practiceItemState.ts:shufflePracticeQueue]` — Fisher-Yates shuffles items then round-robin interleaves buckets by `word_id` so multiple senses of the same word are spaced apart.
- `insertRetryCard(queue, fromIndex, item, random?)` `[practiceItemState.ts:insertRetryCard]` — Shuffles a failed card back into the upcoming queue tail while enforcing a minimum gap (`min(2, tail.length)`) before re-presentation when possible.

## Invariants
- `Flashcard` only activates `PanResponder` horizontal swipe grading when `isFlipped && onRate` is truthy, requires `Math.abs(dx) >= 96` (`SWIPE_THRESHOLD`) and `Math.abs(dx) >= Math.abs(dy)`, and caps height to at least `MIN_CARD_HEIGHT` (`240`) `[Flashcard.tsx:Flashcard]`.
- `PracticeScreen` always scopes due and repeat fetches to `origin: 'private'`, preserves already-graded queue slots (`idx < currentIndexRef.current`) when removing suspended or non-retryable failed items, and only transitions a normal session to `'success'` after `waitForPendingFlushes` drains all pending attempts `[PracticeScreen.tsx:PracticeScreen]`.
- `PracticeScreen` only permits `toggleFlip` when `cardMode !== 'typing' || isFlipped`; typing mode reveals via `revealAnswer`, which requires non-empty trimmed input unless `forgot === true` `[PracticeScreen.tsx:PracticeScreen]`.
- Retryable batch flush errors (`status === 0` or `retryable === true`, or non-`ApiError`) re-prepend failed attempts to `pendingRef.current` and retry after `1500` ms, whereas non-retryable errors drop future queue occurrences of those item IDs `[PracticeScreen.tsx:PracticeScreen]`.
- `sessionProgress` counts each distinct `dueId` at most once toward `completed` regardless of how many passing attempts occur, and guarantees `total >= 1` and `current <= total` `[practiceItemState.ts:sessionProgress]`.
- `applyDueItemUpdatesToList` preserves items at `idx < preserveIndexesBefore` even when marked `suspended` so `currentIndex` remains valid `[practiceItemState.ts:applyDueItemUpdatesToList]`.

## Side Effects
- Calls `getReviewSettings`, `getDueLearningItems`, `listLearningItems`, and `recordBatchReviewAttempts` against backend APIs `[PracticeScreen.tsx:PracticeScreen]`.
- Tracks analytics events (`card_revealed`, `command_invoked`, `review_succeeded`, `review_failed`, `card_rated`) via `analytics.track` `[PracticeScreen.tsx:PracticeScreen]`.
- Mutates shell chrome visibility (`setChromeHidden(status === 'active')`, restored to `false` on unmount/exit) and triggers navigation to `Learn` `[PracticeScreen.tsx:PracticeScreen]`.
- Triggers native `expo-haptics` feedback, `LayoutAnimation` (non-web), `Animated` springs/timings, `setTimeout` retry/scroll timers, `console.error` logging, and keyboard shortcuts (`Space`, `Spacebar`, `Enter`, `1`, `2`, `3`, `4`) `[Flashcard.tsx:Flashcard]`, `[PracticeScreen.tsx:PracticeScreen]`.
- Reads `navigator.userAgent`, `Platform.OS`, window dimensions, and `Date.now()` for responsive sizing and response-time measurement `[Flashcard.tsx:Flashcard]`, `[PracticeScreen.tsx:PracticeScreen]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

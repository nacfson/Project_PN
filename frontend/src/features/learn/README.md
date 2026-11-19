# Learn Feature

## Overview
Implements the Learn ("Today") home dashboard displaying due-review readiness, daily XP goal progress, review streak and freeze counts, upcoming review previews, and a six-stage mastery distribution bar powered by pure summary calculations.

## Interface
- `HomeScreen()` `[HomeScreen.tsx:HomeScreen]` — Main Learn tab dashboard with pull-to-refresh, hero review/add CTA card, 3-column/stacked glance strip, up-next due items preview, and mastery breakdown card.
- `MasteryBar({ stageCounts })` `[MasteryBar.tsx:MasteryBar]` and `MasteryBarProps` `[MasteryBar.tsx:MasteryBarProps]` — Proportional stacked horizontal bar and legend across all six learning stages (`new`, `learning`, `recognized`, `recalled`, `usable`, `mastered`).
- `XP_PER_REVIEW` (`10`) `[todaySummary.ts:XP_PER_REVIEW]` — XP awarded per completed review.
- `estimateMinutes(due)` `[todaySummary.ts:estimateMinutes]` — Estimates review duration at 30 seconds per due card (minimum `1` minute when `due > 0`, `0` otherwise).
- `totalWords(stageCounts)` `[todaySummary.ts:totalWords]` — Sums numeric values in `stageCounts`.
- `nextReviewAfterToday(forecast, todayIsoDate?)` `[todaySummary.ts:nextReviewAfterToday]` — Returns the first forecast item strictly after `todayIsoDate` (defaulting to current UTC `YYYY-MM-DD`) with `count > 0`, or `null`.
- `remainingCount(due, upNextLength)` `[todaySummary.ts:remainingCount]` — Computes `Math.max(0, due - upNextLength)`.
- `goalPercent(xpToday, dailyGoalXp)` `[todaySummary.ts:goalPercent]` — Computes rounded daily goal completion percentage clamped to `[0, 100]`.
- `mixNote(upNext, due)` `[todaySummary.ts:mixNote]` and `MixNoteKey` `[todaySummary.ts:MixNoteKey]` — Classifies due items as `'today.mixAllNew'`, `'today.mixMostlyReviews'` (<= 25% new), or `'today.mixMixed'`.

## Invariants
- `HomeScreen` caps `upNext` to 5 items (`dueItems.slice(0, 5)`), treats `getDueLearningItems(5)` errors as an empty array so stats still render, and guards focus-triggered async updates with an `activeRef` flag `[HomeScreen.tsx:HomeScreen]`.
- `HomeScreen` defaults `dailyGoalXp` to `200` when omitted by the stats payload and only enables the `Enter` review shortcut when `stats` is loaded and `due_today > 0` `[HomeScreen.tsx:HomeScreen]`.
- `MasteryBar` renders stages in fixed order (`new`, `learning`, `recognized`, `recalled`, `usable`, `mastered`) and only mounts flex bar segments for stages with `count > 0` `[MasteryBar.tsx:MasteryBar]`.
- All summary helpers in `todaySummary.ts` guard against null, undefined, non-finite, or non-positive inputs without throwing `[todaySummary.ts:estimateMinutes]`, `[todaySummary.ts:totalWords]`, `[todaySummary.ts:nextReviewAfterToday]`, `[todaySummary.ts:goalPercent]`, `[todaySummary.ts:mixNote]`.

## Side Effects
- Calls `getStatsSummary()` and `getDueLearningItems(5)` on every screen focus (`useFocusEffect`), pull-to-refresh, and error retry `[HomeScreen.tsx:HomeScreen]`.
- Registers a keyboard shortcut for `Enter` via `useKeyboardShortcut` and triggers tab navigation to `Practice` (`{ origin: 'private' }`), `Add` (`{ mode: 'manual', focusTick }`), or `Words` `[HomeScreen.tsx:HomeScreen]`.
- Reads system clock (`new Date()`), `navigator.userAgent`, `Platform.OS`, and window dimensions for localized date formatting and responsive layout `[HomeScreen.tsx:HomeScreen]`, `[todaySummary.ts:nextReviewAfterToday]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

# Add Feature

## Overview
Provides the vocabulary addition UI sections and target deck selector used inside the Add flow. It supports manual single-word or multi-word phrase lookup with optional source context and personal notes, passage-based span extraction queued for background addition, and inline target deck selection.

## Interface
- `CaptureSection({ selectedDeckId, targetLanguage })` `[CaptureSection.tsx:CaptureSection]` — Passage capture workflow for pasting text, tapping single words or multi-word spans (in phrase mode), choosing an optional part-of-speech filter, and enqueuing selections via `useAddQueue`.
- `ManualAddSection({ selectedDeckId, targetLanguage, resolveDeckId?, autoFocus? })` `[ManualAddSection.tsx:ManualAddSection]` — Primary manual add card with word/phrase validation, collapsible context/personal-note/POS fields, and `SensePicker` confirmation driven by `useSenseFlow`.
- `TargetDeckSelector({ decks, selectedId, onSelect, loading?, error?, onRetry?, disabled? })` `[TargetDeckSelector.tsx:TargetDeckSelector]` — Inline trigger and searchable dropdown list for selecting the destination deck, with error display and retry action.

## Invariants
- Toggling a span in `CaptureSection` removes exact `(start, end, text)` matches and drops any previously selected overlapping spans (`s.end < span.start || s.start > span.end`) when adding a new span `[CaptureSection.tsx:CaptureSection]`.
- Clearing a passage in `CaptureSection` resets `selected` and `phraseAnchor` and opens a `3000` ms (`UNDO_DURATION_MS`) undo window restoring `previousPassageRef.current` `[CaptureSection.tsx:CaptureSection]`.
- `CaptureSection` only enqueues spans whose queue status is neither `'added'` nor `'pending'`; when `pos === 'Any'` and every queued span contains multiple whitespace-separated tokens, the lookup part of speech is promoted to `'phrase'` `[CaptureSection.tsx:CaptureSection]`.
- `ManualAddSection` rejects empty/whitespace-only input and characters matching `/[0-9_]/`, and automatically switches `pos` to `'phrase'` for multi-word inputs (or back to `'Any'` from `'phrase'` for single words) until the user manually picks a part of speech (`posTouched`) `[ManualAddSection.tsx:ManualAddSection]`.
- `ManualAddSection` skips confirmation if neither `selectedDeckId` nor `resolveDeckId()` returns a deck ID, and resets all form fields and validation/touch state when `useSenseFlow` invokes `onAdded` `[ManualAddSection.tsx:ManualAddSection]`.
- `TargetDeckSelector` disables dropdown toggling while `disabled || loading` is true and filters decks case-insensitively by `deck.name` `[TargetDeckSelector.tsx:TargetDeckSelector]`.

## Side Effects
- Records tapped and submitted passage tokens to local capture history via `recordCapturedWords` and enqueues background additions through `useAddQueue().enqueueMany` `[CaptureSection.tsx:CaptureSection]`.
- Schedules and clears a `3000` ms `setTimeout` for the passage clear undo banner `[CaptureSection.tsx:CaptureSection]`.
- Triggers remote sense lookups and learning-item creation through `useSenseFlow` (`lookup`, `confirm`, `forceExisting`, `forceWithPos`) and optionally awaits `resolveDeckId()` during confirmation `[ManualAddSection.tsx:ManualAddSection]`.
- Reads `navigator.userAgent`, `Platform.OS`, and window dimensions to determine wide vs. compact layout `[ManualAddSection.tsx:ManualAddSection]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

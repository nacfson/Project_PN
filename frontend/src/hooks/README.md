# Frontend Hooks (`frontend/src/hooks`)

## Overview
Reusable React hooks and queue providers encapsulating asynchronous word-addition workflows, sense-picker state transitions, background session renewal, web keyboard shortcuts, accessibility motion preferences, debouncing, and active language selection.

## Interface
- `[useActiveTargetLanguage.ts:useActiveTargetLanguage]` — convenience selector over `useLanguage()` returning `{ targetLanguage, displayLanguage, loading, error, refresh }`.
- `[useAddQueue.tsx:AddQueueProvider]` / `[useAddQueue.tsx:useAddQueue]` / `[useAddQueue.tsx:AddJob]` / `[useAddQueue.tsx:AddJobStatus]` — context provider and hook managing a sequential background queue (`enqueue`, `enqueueMany`, `statusOf`, `dismiss`, `jobs`, `pendingCount`, `dismissedIds`) that looks up and adds words automatically.
- `[useAddWord.ts:useAddWord]` — lightweight hook returning `{ addWord, isAdding, lastAdded }` for single-word lookup and addition using the first returned sense.
- `[useDebouncedValue.ts:useDebouncedValue]` — generic hook returning a value delayed by `delayMs` milliseconds.
- `[useKeyboardShortcut.ts:useKeyboardShortcut]` / `[useKeyboardShortcut.ts:KeyboardShortcutOptions]` — web-only `window` `keydown` shortcut binder supporting single keys or key arrays.
- `[useReducedMotion.ts:useReducedMotion]` — cross-platform hook returning whether reduced motion is enabled (`prefers-reduced-motion: reduce` on web, `AccessibilityInfo` on native).
- `[useSenseFlow.ts:useSenseFlow]` — interactive sense-disambiguation state machine exposing `{ pickerVisible, query, options, lookingUp, confirming, generating, error, suggestPosPrompt, lookup, forceExisting, forceWithPos, confirm, close }` (re-exports `PartOfSpeech`).
- `[useSessionRenewal.ts:useSessionRenewal]` — lifecycle hook that schedules proactive bearer-token refreshes and runs foreground keep-alive checks.

## Invariants
- `useAddQueue()` throws if called outside `AddQueueProvider`; the queue processes at most one job at a time (`workerRunning` ref), trims and skips empty inputs, records `ADD-303` when `bestMatch` returns `null`, and maps the latest job per trimmed text to `WordStatus` `[useAddQueue.tsx:AddQueueProvider]`, `[useAddQueue.tsx:useAddQueue]`.
- `useAddWord()` ignores empty words or missing `deckId` and swallows lookup/add failures silently `[useAddWord.ts:useAddWord]`.
- `useKeyboardShortcut()` is a no-op outside `Platform.OS === 'web'` or when `enabled === false`, ignores modified keystrokes (`metaKey`, `ctrlKey`, `altKey`), ignores events originating from `INPUT`/`TEXTAREA`/`SELECT`/`isContentEditable` targets, and calls `event.preventDefault()` before invoking the handler `[useKeyboardShortcut.ts:useKeyboardShortcut]`.
- `useSenseFlow()` prevents concurrent confirmations via `confirmingRef`, refuses to close the picker (`close()`) while confirming, and flips `suggestPosPrompt = true` when a forced lookup rejects with `ApiError` code `'ADD-303'` `[useSenseFlow.ts:useSenseFlow]`.
- `useSessionRenewal()` schedules timer-based refreshes only on non-browser platforms when `enabled` is true; on browser web it refreshes cookie sessions via `me()` on tab visibility resume `[useSessionRenewal.ts:useSessionRenewal]`.

## Side Effects
- Calls `lookupWord` and `addLearningItem` against the backend API (`useAddQueue`, `useAddWord`, `useSenseFlow`) `[useAddQueue.tsx:AddQueueProvider]`, `[useAddWord.ts:useAddWord]`, `[useSenseFlow.ts:useSenseFlow]`.
- Calls `refreshSessionApi`, `me()`, and reads/writes `sessionStorage` (`useSessionRenewal`) `[useSessionRenewal.ts:useSessionRenewal]`.
- Registers and cleans up `window` `keydown` listeners, `matchMedia` / `AccessibilityInfo` listeners, `document` `visibilitychange` listeners, `AppState` change listeners, and `setTimeout` timers `[useKeyboardShortcut.ts:useKeyboardShortcut]`, `[useReducedMotion.ts:useReducedMotion]`, `[useSessionRenewal.ts:useSessionRenewal]`, `[useDebouncedValue.ts:useDebouncedValue]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

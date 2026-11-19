# Frontend Local Feature Storage (`frontend/src/storage`)

## Overview
Lightweight cross-platform persistence helpers for feature-level UX state: recently captured passage words (`captureHistory.ts`) and per-language last-selected target deck (`lastDeck.ts`). Both modules use `localStorage` on web and `expo-secure-store` on native platforms.

## Interface
- `[captureHistory.ts:CaptureHistoryEntry]` — `{ word: string; capturedAt: string }` record shape.
- `[captureHistory.ts:loadCaptureHistory]` — loads, JSON-parses, and prunes captured word history.
- `[captureHistory.ts:recordCapturedWords]` — normalizes, deduplicates, prepends, prunes, and persists newly captured words.
- `[captureHistory.ts:recentCaptureWords]` — returns up to `limit` (default `8`) most recently captured word strings.
- `[lastDeck.ts:getLastDeckId]` — async lookup of the last selected deck ID for an optional `targetLanguage`.
- `[lastDeck.ts:getLastDeckIdSync]` — synchronous lookup from the in-memory cache (falling back to `localStorage` on web).
- `[lastDeck.ts:setLastDeckId]` — updates the in-memory cache and persists the selected deck ID for `targetLanguage`.
- `[lastDeck.ts:clearLastDeckCacheForTest]` — resets the module-level `memoryCache` for unit tests.

## Invariants
- `captureHistory` enforces a 7-day retention window (`RETENTION_MS = 7 * 24 * 60 * 60 * 1000`) and a hard cap of `MAX_ENTRIES = 40`; words are trimmed, lowercased, and deduplicated before prepending `[captureHistory.ts:prune]`, `[captureHistory.ts:recordCapturedWords]`.
- Malformed JSON or non-array values stored under `project_pn_capture_history` safely resolve to `[]` `[captureHistory.ts:loadCaptureHistory]`.
- `lastDeck` namespaces storage keys by `targetLanguage` (`project_pn_last_deck_${targetLanguage}` or `project_pn_last_deck_default`) and populates `memoryCache` on both reads and writes `[lastDeck.ts:storageKey]`, `[lastDeck.ts:readRaw]`, `[lastDeck.ts:writeRaw]`.
- Native `SecureStore` failures in `lastDeck` (reads and writes) and `captureHistory` (reads) are caught and treated as non-fatal `[lastDeck.ts:readRaw]`, `[lastDeck.ts:writeRaw]`, `[captureHistory.ts:readRaw]`.

## Side Effects
- Reads and writes `localStorage` on `Platform.OS === 'web'` and `expo-secure-store` on native platforms under keys `project_pn_capture_history` and `project_pn_last_deck_*` `[captureHistory.ts:writeRaw]`, `[lastDeck.ts:writeRaw]`.
- Mutates module-scoped `memoryCache` in `lastDeck.ts` `[lastDeck.ts:writeRaw]`, `[lastDeck.ts:clearLastDeckCacheForTest]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

# Frontend Contexts (`frontend/src/contexts`)

## Overview
React context providers managing app-wide user state outside navigation stacks. Currently provides the active learning-language state (`LanguageProvider` / `useLanguage`) backed by `/api/user/languages`.

## Interface
- `[LanguageContext.tsx:LanguageProvider]` — provider component fetching and caching the user's configured `UserLanguage[]` pairs and exposing `languages`, `targetLanguage`, `displayLanguage`, `loading`, `isRefreshing`, `error`, `refresh`, and `setActive`.
- `[LanguageContext.tsx:useLanguage]` — hook returning the active `LanguageContextValue` from `LanguageProvider`.

## Invariants
- `useLanguage()` throws `Error('useLanguage must be used within LanguageProvider')` when called outside `LanguageProvider` `[LanguageContext.tsx:useLanguage]`.
- `activeLanguage` resolves to the pair marked `is_active`, falling back to `languages[0]`, or `null` when no pairs exist `[LanguageContext.tsx:LanguageProvider]`.
- Initial fetches toggle `loading`, whereas subsequent `refresh()` calls toggle `isRefreshing` via `hasInitialLoadedRef`; stale in-flight fetches are discarded on unmount or re-fetch via the `active` cancellation flag `[LanguageContext.tsx:LanguageProvider]`.

## Side Effects
- Invokes `getUserLanguages()` on mount and whenever `refresh()` increments the internal `tick` state `[LanguageContext.tsx:LanguageProvider]`.
- Calls `setActiveUserLanguage(targetLanguage)` inside `setActive()` and triggers a refresh upon success, or writes failure messages to local `error` state `[LanguageContext.tsx:LanguageProvider]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

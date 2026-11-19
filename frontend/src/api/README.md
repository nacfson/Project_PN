# Frontend API Repositories (`frontend/src/api`)

## Overview
Client-side API configuration, platform-aware storage adapters, and domain repository wrappers isolating HTTP calls from screen UI code. Bootstraps `@project-pn/api` with environment-specific auth modes (cookie vs. bearer), CSRF cookie extraction, session persistence, development backend diagnostics, and analytics trace instrumentation.

## Interface
- `[client.ts:configureApi]` — module-load configuration of `@project-pn/api` (`baseUrls`, `authMode`, `getToken`, `getRefreshToken`, `onSessionRefreshed`, `getCsrfToken`, `onNetworkError`, `onUnauthorized`); re-exports `* from '@project-pn/api'`.
- `[auth.ts:getLanguageOptions]` / `[auth.ts:clearLanguageOptionsCache]` — 5-minute TTL cached fetch of supported language options and manual cache reset.
- `[auth.ts:me]` / `[auth.ts:refreshSession]` / `[auth.ts:logout]` — authenticated profile fetch, bearer session refresh with persistence, and logout with session cleanup; re-exports `[auth.ts:getLinkedProviders]`, `[auth.ts:createMergeRequest]`, `[auth.ts:confirmMergeRequest]`, `LinkedProvider`, `MeResponse`.
- `[sessionStorage.ts:SessionStorage]` / `[sessionStorage.ts:sessionStorage]` — platform-dispatched session store (no-op on browser web, `localStorage` in Tauri, `expo-secure-store` on iOS/Android).
- `[storage.ts:appLanguageStorage]` / `[storage.ts:onboardingStorage]` / `[storage.ts:clearLegacyThemePreferences]` — local persistence for app UI language (`project_pn_app_language`), onboarding completion (`project_pn_onboarding_completed`), and removal of legacy theme keys (`project_pn_theme_mode`, `project_pn_theme_variation`).
- `[words.ts:lookupWord]` / `[words.ts:addLearningItem]` / `[words.ts:changeLearningItemSense]` / `[words.ts:setLearningItemPersonalNote]` — dictionary lookup and learning-item mutation wrappers instrumented with analytics trace IDs.
- `[learningItems.ts:listLearningItems]` / `[learningItems.ts:getDueLearningItems]` / `[learningItems.ts:recordBatchReviewAttempts]` / `[learningItems.ts:archiveLearningItem]` / `[learningItems.ts:archiveLearningItems]` — re-exports from `./client` along with `ListLearningItemsParams`.
- `[decks.ts:listDecks]` / `[decks.ts:createDeck]` / `[decks.ts:renameDeck]` / `[decks.ts:deleteDeck]` / `[decks.ts:moveItemsToDeck]` — deck CRUD and item-move wrappers with analytics tracking (`Deck` type re-exported).
- `[userLanguages.ts:getUserLanguages]` / `[userLanguages.ts:addUserLanguage]` / `[userLanguages.ts:setActiveUserLanguage]` / `[userLanguages.ts:updateLanguagePair]` / `[userLanguages.ts:removeUserLanguage]` — CRUD wrappers for `/api/user/languages`.
- `[reviewSettings.ts:getReviewSettings]` / `[reviewSettings.ts:patchReviewSettings]` — GET/PATCH `/api/reviews/settings` with analytics tracking.
- `[streakSettings.ts:getStreakSettings]` / `[streakSettings.ts:patchStreakSettings]` — GET/PATCH `/api/streaks/settings` with analytics tracking.
- `[stats.ts:getStatsSummary]` — `GET /api/stats/summary`.
- `[content.ts:getWordOfTheDay]` / `[content.ts:getContentChallenges]` — `GET /api/content/word-of-the-day` and `GET /api/content/challenges` (`WordOfTheDay`, `ContentChallenge`, `ContentChallengesResponse`).
- `[import.ts:previewAnkiImport]` / `[import.ts:importAnkiCards]` — `POST /api/import/anki/preview` (`FormData`) and `POST /api/import/anki` (`JSON`).
- `[notifications.ts:registerPushToken]` / `[notifications.ts:RegisterPushTokenRequest]` — `POST /api/notifications/register`.
- `[devBackendHint.ts:formatUnreachableBackendMessage]` / `[devBackendHint.ts:reportUnreachableBackend]` / `[devBackendHint.ts:resetUnreachableBackendReport]` — `__DEV__`-only throttled console diagnostics for unreachable local backends.

## Invariants
- Browser web uses `'cookie'` auth mode with no-op `sessionStorage` and reads the `project_pn_csrf` cookie for CSRF headers, except in `__DEV__` when a URL launch token is present (which switches to `'bearer'` mode); Tauri and native always use `'bearer'` mode `[client.ts:resolveAuthMode]`, `[client.ts:getCsrfToken]`, `[sessionStorage.ts:sessionStorage]`.
- `onUnauthorized` clears `sessionStorage` only on non-browser platforms `[client.ts:configureApi]`.
- `logout()` preserves local session state and rethrows without clearing storage when the backend responds with HTTP `502` or `503`; for all other outcomes it clears the language-options cache, scrubs `token`/`refresh_token`/`expires_at`/`code` query parameters from the browser URL, and clears `sessionStorage` `[auth.ts:logout]`.
- `getLanguageOptions()` caches the in-flight/resolved promise for 5 minutes (`CACHE_TTL_MS`) and evicts the cache immediately on rejection `[auth.ts:getLanguageOptions]`.
- `reportUnreachableBackend()` emits nothing outside `__DEV__` and suppresses duplicate logs within `REPEAT_WINDOW_MS` (10 seconds) `[devBackendHint.ts:reportUnreachableBackend]`.
- `lookupWord()` defaults `languageCode` to `DEFAULT_LANGUAGE_CODE` and `displayLanguageCode` to `DEFAULT_DEFINITION_LANGUAGE_CODE` `[words.ts:lookupWord]`.

## Side Effects
- Executes `configureApi(...)` globally upon importing `client.ts` `[client.ts:configureApi]`.
- Performs HTTP requests against `/api/*` endpoints via `@project-pn/api` `[auth.ts:me]`, `[content.ts:getWordOfTheDay]`, `[decks.ts:createDeck]`, `[import.ts:previewAnkiImport]`, `[notifications.ts:registerPushToken]`, `[reviewSettings.ts:getReviewSettings]`, `[stats.ts:getStatsSummary]`, `[streakSettings.ts:getStreakSettings]`, `[userLanguages.ts:getUserLanguages]`, `[words.ts:lookupWord]`.
- Reads/writes `localStorage` (web/Tauri) and `expo-secure-store` (native), reads `document.cookie`, and mutates browser history via `window.history.replaceState` `[sessionStorage.ts:sessionStorage]`, `[storage.ts:appLanguageStorage]`, `[auth.ts:scrubLaunchTokenFromBrowserUrl]`, `[client.ts:getCsrfToken]`.
- Emits analytics events (`deck_*`, `word_*`, `meaning_search_*`, `sense_*`, `settings_changed`, `api_request_failed`) and logs to `console.error` on 401 clear failure or `__DEV__` network errors `[decks.ts:createDeck]`, `[words.ts:lookupWord]`, `[reviewSettings.ts:patchReviewSettings]`, `[streakSettings.ts:patchStreakSettings]`, `[devBackendHint.ts:reportUnreachableBackend]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

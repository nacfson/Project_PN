# `@project-pn/api` Source

## Overview
Platform-agnostic TypeScript API client shared by the Expo/React Native frontend and the Chrome/Edge browser extension. Provides configurable HTTP transport with multi-endpoint fallback and single-flight token refresh, canonical backend DTOs, domain endpoint wrappers (auth, decks, words, learning items/reviews), and validated analytics event construction.

## Interface
- Barrel re-export of `./client`, `./types`, `./auth`, `./decks`, `./words`, `./learningItems`, and `./analytics` `[index.ts:*]`
- Transport & configuration: `ApiConfig`, `RequestOptions`, `ApiError`, `API_LAST_WORKING_TIMEOUT_MS` (`60000`), `API_PROBE_TIMEOUT_MS` (`60000`), `configureApi`, `onUnauthorized`, `getJson`, `postJson`, `patchJson`, `deleteJson`, `postFormData`, `postNoContent` `[client.ts:configureApi]` `[client.ts:getJson]`
- Auth endpoints: `getLanguageOptions` (`GET /api/auth/language-options`), `me` (`GET /api/auth/me`), `refreshSession` (`POST /api/auth/refresh`), `logout` (`POST /api/auth/logout`), `getLinkedProviders` (`GET /api/auth/linked-providers`), `getMergeSuggestions` (`GET /api/auth/merge-suggestions`), `createMergeRequest` (`POST /api/auth/merge-requests`), `confirmMergeRequest` (`POST /api/auth/merge-requests/:id/confirm`) `[auth.ts:me]` `[auth.ts:logout]`
- Deck endpoints: `listDecks` (`GET /api/decks`), `createDeck` (`POST /api/decks`), `renameDeck` (`PATCH /api/decks/:id`), `deleteDeck` (`DELETE /api/decks/:id`), `moveItemsToDeck` (`POST /api/decks/:id/move-items`) `[decks.ts:listDecks]` `[decks.ts:moveItemsToDeck]`
- Word & sense endpoints: `LookupOptions`, `lookupWord` (`POST /api/words/lookup`), `addLearningItem` (`POST /api/learning-items`), `changeLearningItemSense` (`PATCH /api/learning-items/:id`), `setLearningItemPersonalNote` (`PATCH /api/learning-items/:id`) `[words.ts:lookupWord]` `[words.ts:addLearningItem]`
- Learning item & review endpoints: `ListLearningItemsParams`, `listLearningItems` (`GET /api/learning-items`), `archiveLearningItem` (`DELETE /api/learning-items/:id`), `archiveLearningItems` (`POST /api/learning-items/archive`), `getDueLearningItems` (`GET /api/reviews/due`), `recordBatchReviewAttempts` (`POST /api/reviews/batch`) `[learningItems.ts:listLearningItems]` `[learningItems.ts:recordBatchReviewAttempts]`
- Analytics schema & helpers: `ANALYTICS_EVENT_VERSION` (`1`), `ANALYTICS_EVENT_NAMES`, `AnalyticsEventName`, `AnalyticsPlatform`, `AnalyticsEvent`, `CreateAnalyticsEventInput`, `createAnalyticsEvent`, `validateAnalyticsEvent`, `createUUID` `[analytics.ts:createAnalyticsEvent]` `[analytics.ts:validateAnalyticsEvent]`
- Shared DTOs: `PartOfSpeech`, `PosFilter`, `Example`, `SenseOption`, `LookupRequest`, `LookupResponse`, `LearningItem`, `LearningItemListItem`, `LearningItemsPage`, `DeckOrigin`, `Deck`, `ReviewActivityType`, `ReviewAttemptParams`, `BatchReviewItemUpdate`, `BatchReviewResult`, `DueItem`, `SessionResponse`, `UserLanguage`, `MeResponse`, `AuthProvider`, `LinkedProvider`, `MergeSuggestion`, `MergeRequestResponse`, `LanguagePair`, `AllowedLanguages`, `LanguageOptionsResponse`, `UpdateLanguagePairRequest` `[types.ts:SenseOption]` `[types.ts:MeResponse]`

## Invariants
- Calling any request helper before `configureApi()` throws `Error('ApiClient not configured. Call configureApi() first.')` `[client.ts:getConfig]`
- Concurrent `401` responses coalesce onto a single in-flight `refreshPromise`; refresh is bypassed when `authMode === 'cookie'`, `options.auth === false`, or the path is `/api/auth/refresh` or `/api/auth/logout` `[client.ts:canRefreshSession]` `[client.ts:attemptRefresh]`
- In `cookie` auth mode, requests pass `credentials: 'include'`, omit `Authorization`, and attach `X-CSRF-Token` on mutations (`POST`, `PATCH`, `DELETE`, `postFormData`) `[client.ts:buildHeaders]` `[client.ts:postFormData]`
- Non-empty responses that fail `JSON.parse` throw `ApiError(status, 'The server returned an invalid response.', 'API-599', true)` `[client.ts:parseResponse]`
- `logout()` throws `ApiError(502, ...)` if a non-null JSON response does not report `status === 'revoked'` `[auth.ts:logout]`
- `lookupWord()` strips `partOfSpeech` when set to `'Any'`; `PosFilter` `'Any'` is never persisted to `/api/learning-items` `[words.ts:lookupWord]` `[types.ts:PosFilter]`
- `listLearningItems()` caps `limit` at `100` (default `50`) and defaults `descending` to `true` `[learningItems.ts:listLearningItems]`
- `getDueLearningItems()` omits `origin` whenever a non-empty `deckId` is provided `[learningItems.ts:getDueLearningItems]`
- `validateAnalyticsEvent()` requires a registered `event_name`, `event_version === 1`, valid UUIDs for `event_id`/`session_id`/`trace_id`/`anonymous_id`, parseable RFC3339 `occurred_at`, `1..128`-char `app_version`, non-array object `properties`, and rejects forbidden credential keys (`token`, `access_token`, `refresh_token`, `id_token`, `password`, `secret`, `authorization`, `cookie`, `set_cookie`) recursively `[analytics.ts:validateAnalyticsEvent]` `[analytics.ts:containsForbiddenProperty]`

## Side Effects
- Mutates module-level state (`config`, `lastWorkingBaseUrl`, `refreshPromise`, `unauthorizedListeners`) across requests `[client.ts:configureApi]` `[client.ts:onUnauthorized]` `[client.ts:fetchWithFallback]`
- Performs network I/O via `config.fetchImpl ?? fetch` across `baseUrls` (prioritizing `lastWorkingBaseUrl`) with 60-second `setTimeout` races and per-request `X-Client-Trace-Id` headers `[client.ts:fetchWithTimeout]` `[client.ts:fetchWithFallback]`
- Invokes caller callbacks `onSessionRefreshed`, `onUnauthorized`, subscribed `unauthorizedListeners`, and `onNetworkError` `[client.ts:attemptRefresh]` `[client.ts:notifyUnauthorized]` `[client.ts:fetchWithFallback]`
- Reads wall-clock time (`new Date().toISOString()`) and randomness (`crypto.randomUUID()` or `Math.random()`) when generating analytics events and trace IDs `[analytics.ts:createAnalyticsEvent]` `[analytics.ts:createUUID]`

## Verification
- Run: `npm test -w packages/api && npm run typecheck -w packages/api`

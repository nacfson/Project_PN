# Frontend Utilities (`frontend/src/utils`)

## Overview
Pure helpers and runtime adapters supporting word-addition error classification, OAuth/deep-link session launch parsing, browser-extension session handoff, device locale detection, concise Korean/English gloss normalization, Tauri vs. browser platform detection, sense similarity ranking, proactive token-renewal timing, and sentence highlighting.

## Interface
- `[addErrors.ts:classifyAddError]` / `[addErrors.ts:AddErrorInfo]` — maps unknown errors and `ApiError` codes (`ADD-301..308`, `ADD-401..404`, `AUTH-101/102/599`, `SEC-101/102/599`, network `status === 0` -> `ADD-101`) to `{ code, messageKey, retryable }` with `ADD-599` fallback.
- `[authLaunch.ts:extractTokenFromUrl]` / `[authLaunch.ts:extractSessionFromUrl]` / `[authLaunch.ts:parseSessionFromLaunchUrl]` / `[authLaunch.ts:parseTokenFromLaunchUrl]` / `[authLaunch.ts:parseVerifiedEmailFromLaunchUrl]` — extracts session/token parameters from query strings or URL fragments and exchanges browser `?code=` callbacks via `POST /api/auth/session`.
- `[extensionAuth.ts:isExtensionLoginFlow]` / `[extensionAuth.ts:sendSessionToExtension]` — detects `?extension=1` web login flows and relays `SessionResponse` to the configured Chrome extension (`PN_EXTENSION_ID`).
- `[locale.ts:getDeviceLanguageCode]` — returns the lowercase ISO 639-1 primary device language code from `expo-localization`.
- `[meanings.ts:MeaningFields]` / `[meanings.ts:isSimpleGloss]` / `[meanings.ts:normalizeKoreanPredicate]` / `[meanings.ts:extractKoreanHeadword]` / `[meanings.ts:preferSimpleGloss]` / `[meanings.ts:uniqueText]` / `[meanings.ts:displayGloss]` / `[meanings.ts:splitMeanings]` — normalizes and selects a single concise display gloss prioritizing `personal_note`, then localized glosses, then English glosses.
- `[platform.ts:isTauri]` / `[platform.ts:isBrowserWeb]` — distinguishes Tauri desktop webviews (`__TAURI__` / `__TAURI_INTERNALS__`) from regular browser web and native runtimes.
- `[senses.ts:CLOSEST_SIMILARITY_THRESHOLD]` / `[senses.ts:bestMatch]` / `[senses.ts:isClosestToContext]` — ranks `SenseOption[]` by numeric `similarity` (falling back to lowest `meaning_order`) and badges top matches meeting `>= 0.08`.
- `[sessionRenewal.ts:REFRESH_BUFFER_MS]` / `[sessionRenewal.ts:PROACTIVE_THRESHOLD_MS]` / `[sessionRenewal.ts:msUntilRefresh]` / `[sessionRenewal.ts:shouldRefreshProactively]` — computes token refresh delays (5-minute buffer) and proactive foreground refresh eligibility (10-minute threshold).
- `[text.tsx:highlightWordInSentence]` / `[text.tsx:renderBoldMarkdown]` / `[text.tsx:renderFormattedSentence]` / `[text.tsx:getPosColor]` / `[text.tsx:getPosBadgeVariant]` — renders bolded target words or `**markdown**` spans into React nodes and maps parts of speech to theme colors/badge variants.

## Invariants
- `classifyAddError` maps non-`ApiError` values and unrecognized codes to `{ code: 'ADD-599', messageKey: 'add.error.unknown', retryable: true }`, and maps `ApiError` with `status === 0` to `ADD-101` `[addErrors.ts:classifyAddError]`.
- `extractSessionFromUrl` returns `null` when `token` is absent, defaults `refresh_token` to `token`, and defaults `expires_at` to 1 hour from now; `parseVerifiedEmailFromLaunchUrl` always resolves to `null` `[authLaunch.ts:extractSessionFromUrl]`, `[authLaunch.ts:parseVerifiedEmailFromLaunchUrl]`.
- `displayGloss` follows strict precedence: `personal_note` -> `preferSimpleGloss(localized_short_definition, localized_definition)` -> `preferSimpleGloss(short_definition, definition)` -> raw trimmed fallback; `splitMeanings` always returns `full: null` `[meanings.ts:displayGloss]`, `[meanings.ts:splitMeanings]`.
- `isClosestToContext` returns `true` only when the option is `bestMatch(options)` and has `similarity >= 0.08` (`CLOSEST_SIMILARITY_THRESHOLD`) `[senses.ts:isClosestToContext]`.
- `msUntilRefresh` clamps negative delays to `0` and returns `null` for missing or invalid timestamps; `shouldRefreshProactively` returns `false` for invalid timestamps `[sessionRenewal.ts:msUntilRefresh]`, `[sessionRenewal.ts:shouldRefreshProactively]`.
- `renderFormattedSentence` delegates to `renderBoldMarkdown` whenever the sentence contains `'**'`, otherwise highlights case-insensitive word-stem matches via `highlightWordInSentence` `[text.tsx:renderFormattedSentence]`.

## Side Effects
- `parseSessionFromLaunchUrl` mutates browser URL history via `window.history.replaceState` to remove `?code=`, performs `fetch('${API_BASE_URL}/api/auth/session', { method: 'POST', ... })` on browser web, and reads `Linking.getInitialURL()` on non-web runtimes `[authLaunch.ts:parseSessionFromLaunchUrl]`.
- `sendSessionToExtension` invokes `chrome.runtime.sendMessage(PN_EXTENSION_ID, session)` when both `PN_EXTENSION_ID` and Chrome runtime messaging are present `[extensionAuth.ts:sendSessionToExtension]`.
- `getDeviceLanguageCode` queries OS locales via `Localization.getLocales()` `[locale.ts:getDeviceLanguageCode]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

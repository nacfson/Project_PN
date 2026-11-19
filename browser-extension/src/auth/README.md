# Browser Extension Auth

## Overview
Handles web-app-delegated authentication for the Chrome/Edge extension and manages persistence of auth tokens and user preferences in `chrome.storage.local`.

## Interface
- `extensionStorage` — async wrapper around `chrome.storage.local` exposing `getToken`, `getRefreshToken`, `getExpiresAt`, `setSession`, `setToken`, `clearSession`, `removeToken`, `getDefaultDeckId`, `setDefaultDeckId`, `getTargetLanguage`, `setTargetLanguage`, `getDisplayLanguage`, and `setDisplayLanguage` `[storage.ts:extensionStorage]`
- `openLoginWindow()` — opens a 420x560 popup window to the Project PN web login flow with `?extension=1` `[login.ts:openLoginWindow]`
- `chrome.runtime.onMessageExternal` listener — receives `{ token, refresh_token?, expires_at? }` auth messages from the Project PN web app and responds `{ success: true }` `[login.ts:chrome.runtime.onMessageExternal]`

## Invariants
- External auth messages are ignored unless `sender.origin` matches `ALLOWED_ORIGINS` (`https://app.projectpn.com` or `http://localhost:8081`) `[login.ts:ALLOWED_ORIGINS]`
- External auth payloads must provide a non-empty string `message.token`; when `refresh_token` is not a string it defaults to `message.token`, and when `expires_at` is not a string `expires_at` defaults to `Date.now() + 3600_000` in ISO-8601 format `[login.ts:chrome.runtime.onMessageExternal]`
- `openLoginWindow()` routes to `LOCAL_LOGIN_URL` (`http://localhost:8081/login?extension=1`) when `process.env.EXT_API_BASE_URL` is unset or includes `'localhost'`, and to `LOGIN_URL` (`https://app.projectpn.com/login?extension=1`) otherwise `[login.ts:openLoginWindow]`
- All persisted keys use fixed `pn_*` names (`pn_token`, `pn_refresh_token`, `pn_expires_at`, `pn_default_deck_id`, `pn_target_language`, `pn_display_language`), and absent keys resolve to `null` `[storage.ts:TOKEN_KEY]` `[storage.ts:get]`

## Side Effects
- Reads, writes, and removes entries in `chrome.storage.local` via `get`, `set`, and `remove` helpers `[storage.ts:extensionStorage]`
- Importing `login.ts` immediately registers a global `chrome.runtime.onMessageExternal` listener `[login.ts:chrome.runtime.onMessageExternal]`
- Logs rejected sender origins via `console.error` `[login.ts:chrome.runtime.onMessageExternal]`
- Opens a Chrome popup window via `chrome.windows.create` `[login.ts:openLoginWindow]`
- Writes received session tokens to `chrome.storage.local` via `extensionStorage.setSession` `[login.ts:chrome.runtime.onMessageExternal]`

## Verification
- Run: `npm test -w browser-extension && npm run typecheck -w browser-extension`

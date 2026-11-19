# Browser Extension API Client

## Overview
Configures the shared `@project-pn/api` HTTP client singleton for the Chrome/Edge Manifest V3 extension runtime and re-exports the full `@project-pn/api` surface for use by extension scripts.

## Interface
- Re-exports all symbols from `@project-pn/api` (`export * from '@project-pn/api'`) `[client.ts:*]`
- Module-level `configureApi(...)` initialization wiring the extension API base URL and `extensionStorage` auth callbacks `[client.ts:configureApi]`

## Invariants
- Configures a single base URL from `process.env.EXT_API_BASE_URL`, falling back to `'http://localhost:8080'` when unset `[client.ts:configureApi]`
- Binds token lookup (`getToken`), refresh token lookup (`getRefreshToken`), refreshed session persistence (`onSessionRefreshed`), and unauthorized cleanup (`onUnauthorized`) directly to `extensionStorage` (`../auth/storage`) `[client.ts:configureApi]`

## Side Effects
- Importing `client.ts` immediately mutates the global `@project-pn/api` client configuration via `configureApi(...)` `[client.ts:configureApi]`
- Registers callbacks that read, update, and clear `chrome.storage.local` via `extensionStorage` during authenticated requests and 401 handling `[client.ts:configureApi]`

## Verification
- Run: `npm test -w browser-extension && npm run typecheck -w browser-extension`

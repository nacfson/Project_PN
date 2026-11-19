# Browser Extension Types

## Overview
Defines shared TypeScript message payload contracts and ambient build-time environment variable typings for the browser extension.

## Interface
- `AddToastPayload` — interface describing the `SHOW_ADD_TOAST` payload sent from the service worker to the content script (`text`, `senseOptions`, `decks`, `defaultSenseId?`, `defaultDeckId?`, `displayLanguage`) `[index.ts:AddToastPayload]`
- Ambient global `process.env.EXT_API_BASE_URL?: string` declaration matching the esbuild compile-time `define` substitution `[global.d.ts:process]`

## Invariants
- `AddToastPayload` reuses canonical `Deck` and `SenseOption` DTOs from `@project-pn/api` `[index.ts:AddToastPayload]`

## Side Effects
- None

## Verification
- Run: `npm test -w browser-extension && npm run typecheck -w browser-extension`

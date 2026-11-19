# Browser Extension Popup

## Overview
Implements the Manifest V3 browser-action popup UI showing authentication status, the signed-in user's email, the resolved default deck, and Sign In / Sign Out actions.

## Interface
- Popup HTML shell defining `#app`, `.header`, `#content`, stylesheet `popup.css`, and bundled script `popup.js` `[popup.html:#content]`
- Popup stylesheet styling the 280px popup layout (`.header`, `.logo`, `.title`, `.status`, `.status.error`, `button`, `.deck-row`, `.label`, `.value`) `[popup.css:body]`
- `render()` — internal async renderer executed on script load to hydrate `#content` for signed-out, signed-in, or error states `[popup.ts:render]`
- `escapeHtml(text)` — DOM-based HTML escaping helper for interpolated user and deck labels `[popup.ts:escapeHtml]`

## Invariants
- Requires a `#content` DOM element to exist at script evaluation time (`document.getElementById('content')!`) `[popup.ts:content]`
- Escapes remote `user.email` and `defaultDeck.name` values with `escapeHtml` before writing to `content.innerHTML` `[popup.ts:escapeHtml]`
- Resolves the default deck as the deck with `is_default === true`, falling back to `decks[0]` `[popup.ts:render]`

## Side Effects
- Invokes `render()` immediately on module load, mutating `#content` DOM and binding click handlers on `#signInBtn` and `#signOutBtn` `[popup.ts:render]`
- Reads stored token and target language and writes the resolved default deck ID in `chrome.storage.local` via `extensionStorage` (`getToken`, `getTargetLanguage`, `setDefaultDeckId`, `clearSession`) `[popup.ts:render]`
- Issues network requests to `GET /api/decks` and `GET /api/auth/me` via `listDecks` and `me` `[popup.ts:render]`
- Opens the login popup window via `openLoginWindow()` when `#signInBtn` is clicked `[popup.ts:render]`

## Verification
- Run: `npm test -w browser-extension && npm run typecheck -w browser-extension`

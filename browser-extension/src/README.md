# Browser Extension Source

## Overview
Runtime TypeScript entrypoints and UI modules for the Project PN Chrome/Edge Manifest V3 extension: the background service worker, context menu registration, on-demand injected content script, and inline sense/deck confirmation toast.

## Interface
- `createContextMenu()` — registers the selection context-menu item `pn-add-word` (`Add “%s” to Project PN`) `[contextMenu.ts:createContextMenu]`
- `removeContextMenu()` — removes all extension context-menu items `[contextMenu.ts:removeContextMenu]`
- `showAddToast(target, payload, onAdd, onCancel)` — mounts an inline sense/deck picker anchored to a DOM `Range` and returns `{ close }` `[inlineToast.ts:showAddToast]`
- Service worker lifecycle & messaging handlers: `chrome.runtime.onInstalled`, `chrome.contextMenus.onClicked` (for `pn-add-word`), and `chrome.runtime.onMessage` (handling `ADD_ITEM`) `[background.ts:chrome.contextMenus.onClicked]` `[background.ts:chrome.runtime.onMessage]`
- Content script message handler: `chrome.runtime.onMessage` handling `PING`, `SHOW_ADD_TOAST`, and `SHOW_ERROR_TOAST` `[content.ts:chrome.runtime.onMessage]`
- [api](./api/README.md) — Configures and re-exports `@project-pn/api` for the extension runtime
- [auth](./auth/README.md) — Web login popup flow, external auth message listener, and `chrome.storage.local` wrapper
- [popup](./popup/README.md) — Browser-action popup HTML, CSS, and controller script
- [types](./types/README.md) — `AddToastPayload` contract and ambient `process.env` typings

## Invariants
- Service worker imports `./auth/login` at top level so external login messages are always listened for when the service worker wakes `[background.ts:top-level]`
- `pn-add-word` context-menu clicks require a stored auth token (opening the login window otherwise) and a non-empty selection after stripping leading/trailing non-word characters (`/^[^\w]+|[^\w]+$/g`); `targetLanguage` defaults to `'en'` and `displayLanguage` defaults to `'ko'` `[background.ts:chrome.contextMenus.onClicked]`
- `sendToContentScript` pings the active tab first and injects `content.js` via `chrome.scripting.executeScript` only when the ping fails `[background.ts:ensureContentScript]`
- `ADD_ITEM` messages are only processed when `sender.tab?.id` is present `[background.ts:chrome.runtime.onMessage]`
- `SHOW_ADD_TOAST` ignores messages if `window.getSelection()` has `rangeCount === 0` `[content.ts:chrome.runtime.onMessage]`
- `showAddToast` disables the Add button and skips auto-add when either `senseOptions` or `decks` is empty; when enabled, it auto-submits after `AUTO_ADD_MS` (`5000` ms) unless closed or cancelled first `[inlineToast.ts:showAddToast]` `[inlineToast.ts:AUTO_ADD_MS]`
- `close()` is idempotent via the `closed` flag and guarantees cleanup of `setTimeout`, `requestAnimationFrame`, the toast DOM element, and `keydown`/`click` document listeners `[inlineToast.ts:showAddToast]`

## Side Effects
- Registers Chrome extension event listeners (`chrome.runtime.onInstalled`, `chrome.contextMenus.onClicked`, `chrome.runtime.onMessage`) and creates/removes browser context menus `[background.ts:chrome.runtime.onInstalled]` `[contextMenu.ts:createContextMenu]` `[content.ts:chrome.runtime.onMessage]`
- Injects `content.js` and inline selection-extraction functions into active web pages via `chrome.scripting.executeScript` `[background.ts:ensureContentScript]` `[background.ts:chrome.contextMenus.onClicked]`
- Reads `chrome.storage.local` and performs HTTP requests (`lookupWord`, `listDecks`, `addLearningItem`) through `./api/client` `[background.ts:chrome.contextMenus.onClicked]` `[background.ts:chrome.runtime.onMessage]`
- Mutates the host webpage DOM by injecting `.pn-toast` (with `<style>`) and fixed-position status toast `<div>`s (`z-index: 2147483647`), attaching global `document` `keydown`/`click` listeners, and running `setTimeout`/`requestAnimationFrame` timers `[inlineToast.ts:showAddToast]` `[content.ts:showStatusToast]`

## Verification
- Run: `npm test -w browser-extension && npm run typecheck -w browser-extension`

# Browser Extension Word Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement a Manifest V3 browser extension for Chrome and Edge that lets users highlight text on any webpage, right-click to "Add to Project PN", and select the definition sense and destination deck in an inline dynamically positioned toast.

**Architecture:**
1. **Manifest & Bundler Configuration**: Anchors the unpacked Dev ID and builds the TS payload with `esbuild`.
2. **IPC Messaging & Background Worker**: Handles chrome extension callbacks, API fetches to the Go backend, and storage reads.
3. **DOM Content Script & Absolute UI**: Injects dynamically next to the text selection range and hooks keyboard events.
4. **Login Handler Popup**: Communicates token exchanges with the web-app authentication flow.

---

## Tasks

### Task 1: Environment & Tooling Setup
**Files:**
- Create: `browser-extension/manifest.json`
- Create: `browser-extension/package.json`
- Create: `browser-extension/tsconfig.json`
- Create: `browser-extension/build.mjs`

- [x] **Step 1: Setup Manifest V3 configuration**
  Define permissions (`contextMenus`, `scripting`, `storage`), service worker paths, and developer extension keys in `manifest.json`.
- [x] **Step 2: Configure TypeScript compile rules**
  Create `tsconfig.json` targeting ES2022 with browser-compatible DOM typings.
- [x] **Step 3: Write esbuild bundler script**
  Create `build.mjs` to resolve background, content, and popup scripts into a unified `dist/` build directory.
- [x] **Step 4: Verify build output**
  Run: `npm run build:dev` inside `browser-extension/`
  Verify: `dist/manifest.json`, `dist/background.js`, `dist/content.js` exist.

---

### Task 2: Service Worker & Context Menu Setup
**Files:**
- Create: `browser-extension/src/contextMenu.ts`
- Create: `browser-extension/src/background.ts`

- [x] **Step 1: Context menu builder**
  Write menu creation helper inside `src/contextMenu.ts` to register `pn-add-word` for text selections.
- [x] **Step 2: Inject scripting agent**
  In `src/background.ts`, monitor `chrome.contextMenus.onClicked` events, trim selection output, and inject the content script if not already present.
- [x] **Step 3: Background messaging controller**
  Listen for `ADD_ITEM` events and issue POST requests to `/api/v1/learning-items` using stored authorization headers.
- [x] **Step 4: Verify menu creation**
  Verify context menu item "Add to Project PN" appears when selecting text.

---

### Task 3: Content Script & Inline Selection Toast
**Files:**
- Create: `browser-extension/src/content.ts`
- Create: `browser-extension/src/inlineToast.ts`

- [x] **Step 1: Inject window listeners**
  Create `src/content.ts` to listen for messages (`SHOW_ADD_TOAST`, `SHOW_ERROR_TOAST`) and forward payloads to the DOM.
- [x] **Step 2: Create dynamic toast UI wrapper**
  Write DOM compilation and inline CSS templates in `src/inlineToast.ts`.
- [x] **Step 3: Add bounding box selection math**
  Use `window.getSelection()?.getRangeAt(0)` to position the toast dialog at the bottom center of the highlighted text bounding client rect.
- [x] **Step 4: Implement auto-add timer**
  Implement a 5-second `requestAnimationFrame` progress indicator that triggers the add API callback automatically unless dismissed or paused.
- [x] **Step 5: Run UI logic verification**
  Run browser simulation and verify the inline toast renders correct sense dropdown options and fades out on click-outside.

---

### Task 4: Storage & SSO Auth Flow
**Files:**
- Create: `browser-extension/src/auth/storage.ts`
- Create: `browser-extension/src/auth/login.ts`

- [x] **Step 1: secure storage client**
  Write `src/auth/storage.ts` using `chrome.storage.local` to store auth tokens, default target deck ID, and selected languages.
- [x] **Step 2: Implement extension login hook**
  In `src/auth/login.ts`, launch a child popup window pointing to the web app (`/login?extension=1`).
- [x] **Step 3: Listen for web postMessage callbacks**
  Listen for incoming `PN_EXTENSION_AUTH` messages containing tokens and serialize them to local storage.
- [x] **Step 4: Write unit tests for storage**
  Create `src/auth/storage.test.ts` to assert storage serialization.
- [x] **Step 5: Run tests**
  Run: `npm test`
  Verify: All tests pass.

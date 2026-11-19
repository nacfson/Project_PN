# Project PN Browser Extension

A Chrome/Edge Manifest V3 extension that lets you right-click selected text on any webpage and add it to a Project PN deck.

## Overview
Workspace package (`project-pn-extension`) packaging the Manifest V3 Chrome/Edge extension bundle (`dist/`), build script (`build.mjs`), extension manifest (`manifest.json`), TypeScript compiler config (`tsconfig.json`), Jest test configuration (`jest.config.js`), and runtime source modules under `src/`.

## Interface
- Manifest V3 declaration: `manifest_version: 3`, `permissions` (`contextMenus`, `activeTab`, `storage`, `scripting`), `host_permissions: []`, `externally_connectable.matches` (`https://app.projectpn.com/*`, `http://localhost:8081/*`), `background.service_worker: "background.js"`, and `action.default_popup: "popup.html"` `[manifest.json:manifest_version]`
- Build entrypoint `build()` bundling `src/background.ts`, `src/content.ts`, and `src/popup/popup.ts` via esbuild into `dist/` (IIFE, `chrome120`) and emitting `dist/manifest.json`, `dist/popup.html`, and `dist/popup.css`; accepts `--dev` CLI flag `[build.mjs:build]` `[build.mjs:loadEnv]`
- Workspace scripts: `build` (`node build.mjs`), `build:dev` (`node build.mjs --dev`), `typecheck` (`tsc --noEmit`), and `test` (`jest`) `[package.json:scripts]`
- Jest configuration using `ts-jest` in `node` test environment rooted at `<rootDir>/src` `[jest.config.js:module.exports]`
- TypeScript strict configuration targeting `ES2022` with `DOM`, `chrome`, and `jest` types `[tsconfig.json:compilerOptions]`
- [src](./src/README.md) — Service worker, context menu, content script, inline toast, popup, auth, API client, and types

## Invariants
- `build.mjs` loads `.env` without overwriting already-exported `process.env` variables and substitutes `process.env.EXT_API_BASE_URL` at bundle time (defaulting to `'http://localhost:8080'`) `[build.mjs:loadEnv]` `[build.mjs:build]`
- `manifest.key` is injected from `PN_DEV_EXTENSION_KEY` only when `--dev` is passed and `PN_DEV_EXTENSION_KEY` is non-empty; production builds omit the dev key and enable minification while disabling sourcemaps `[build.mjs:build]`
- `manifest.json` restricts `externally_connectable.matches` to `https://app.projectpn.com/*` and `http://localhost:8081/*` and declares no `host_permissions` `[manifest.json:externally_connectable]`

## Side Effects
- Reads `.env`, `manifest.json`, `src/popup/popup.html`, and `src/popup/popup.css` from disk, mutates `process.env` with missing `.env` entries, writes bundled JS/maps, `dist/manifest.json`, `dist/popup.html`, and `dist/popup.css` into `dist/`, and exits with code `1` on build errors `[build.mjs:loadEnv]` `[build.mjs:build]`

## Verification
- Run: `npm test -w browser-extension && npm run typecheck -w browser-extension`

## Features

- Right-click any selected word or phrase → **Add to Project PN**
- Inline toast to confirm or change sense and deck before saving
- Reuses the shared `@project-pn/api` package
- Authenticates through the web app login flow

## Project Layout

```text
browser-extension/
├── manifest.json          # Manifest V3
├── build.mjs              # esbuild bundler
├── src/
│   ├── background.ts      # Service worker, context menu, API calls
│   ├── content.ts         # Injected content script, toast handler
│   ├── inlineToast.ts     # Inline sense/deck selector UI
│   ├── contextMenu.ts     # Context-menu registration
│   ├── api/client.ts      # Configures @project-pn/api for the extension
│   ├── auth/
│   │   ├── storage.ts     # chrome.storage.local wrapper
│   │   └── login.ts       # Login popup + external message listener
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.ts
│   └── types/index.ts
```

## Build

```sh
cd /Users/hyungjuyu/Projects/iOS/Project_PN/browser-extension
npm install
npm run build:dev
```

Output goes to `dist/`. Load `dist/` as an unpacked extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `browser-extension/dist`

## Environment Variables

Copy `.env.example` to `.env` and adjust:

```sh
EXT_API_BASE_URL=http://localhost:8080
PN_DEV_EXTENSION_KEY=...
```

`PN_DEV_EXTENSION_KEY` keeps the unpacked dev extension ID stable across rebuilds. Generate a key pair:

```sh
openssl genrsa -out /tmp/pn-dev-key.pem 2048
openssl rsa -in /tmp/pn-dev-key.pem -pubout -out /tmp/pn-dev-pub.pem
grep -v '^---' /tmp/pn-dev-pub.pem | tr -d '\n'
```

Paste the base64 public key as `PN_DEV_EXTENSION_KEY`.

After loading the extension, copy the stable extension ID and set:

- `EXPO_PUBLIC_PN_EXTENSION_ID` in `frontend/.env`
- `PN_DEV_EXTENSION_ID` in `backend/.env`

## Tests

```sh
npm test
```

## Auth Flow

1. Open the extension popup and click **Sign In**
2. A popup opens the web app login page with `?extension=1`
3. After logging in, the web app sends the token to the extension via `chrome.runtime.sendMessage`
4. The extension stores the token in `chrome.storage.local`

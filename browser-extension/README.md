# Project PN Browser Extension

A Chrome/Edge Manifest V3 extension that lets you right-click selected text on any webpage and add it to a Project PN deck.

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

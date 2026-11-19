# Frontend Source (`frontend/src`)

## Overview
Application source root for the Project PN React Native / Expo / Tauri frontend. Provides global API base URL and language constants (`config.ts`), WebKit/WKWebView CSSOM style mirroring for Tauri desktop (`webkitStyleFix.web.ts`), and 14 domain/infrastructure subdirectories covering API repositories, navigation, UI primitives, theme, i18n, hooks, storage, and vertical feature modules.

## Interface
- `[config.ts:API_BASE_URL]` / `[config.ts:API_BASE_URLS]` — resolved API base URL and `__DEV__`-only fallback list (`EXPO_PUBLIC_API_BASE_URL`, hosted web same-origin, Expo dev host URI, release mobile fallback `https://pn.nacfson.cloud`, local dev defaults).
- `[config.ts:DEFAULT_LANGUAGE_CODE]` (`'en'`), `[config.ts:DEFAULT_DEFINITION_LANGUAGE_CODE]` (`'ko'`), `[config.ts:PN_EXTENSION_ID]`, `[config.ts:LanguageOption]`, `[config.ts:SUPPORTED_LANGUAGES]` — default learning/definition language codes, Chrome extension ID, and 7 supported language options (`en`, `ko`, `ja`, `es`, `fr`, `de`, `zh`).
- `[webkitStyleFix.ts:module]` / `[webkitStyleFix.web.ts:installStyleMirror]` — platform-split side-effect module (no-op on native; on WebKit/WKWebView non-Chromium browsers or when `localStorage.rnwStyleMirror === 'force'`, patches `CSSStyleSheet.prototype.insertRule`/`deleteRule` and `CSSGroupingRule.prototype.insertRule` to mirror CSSOM rules into `<style id="rnw-webkit-style-mirror">`).
- Subdirectories:
  - [analytics](./analytics/README.md) — Best-effort client analytics batching and upload to `/api/analytics/events`.
  - [api](./api/README.md) — `@project-pn/api` setup, storage adapters, and domain HTTP repositories.
  - [components](./components/README.md) — Reusable domain UI components (`SensePicker`, `TappablePassage`, `QueueBanner`, `SpeakButton`, `WordChip`, etc.).
  - [contexts](./contexts/README.md) — App-wide `LanguageProvider` / `useLanguage` context.
  - [features](./features/README.md) — Vertical feature modules (`add`, `auth`, `import`, `learn`, `practice`, `profile`, `web`, `words`).
  - [hooks](./hooks/README.md) — Reusable hooks and providers (`AddQueueProvider`, `useSenseFlow`, `useSessionRenewal`, `useKeyboardShortcut`, etc.).
  - [i18n](./i18n/README.md) — English/Korean localization provider and type-checked dictionaries.
  - [navigation](./navigation/README.md) — React Navigation root, tabs, stacks, deep linking, responsive frames, and `AddScreen`.
  - [screens](./screens/README.md) — Standalone pre-auth `CentralAuthScreen` and first-run `OnboardingScreen`.
  - [storage](./storage/README.md) — Cross-platform local storage for capture history and last-selected deck.
  - [theme](./theme/README.md) — Light-only KidLearn design tokens, fonts, motion presets, and `ThemeProvider`.
  - [types](./types/README.md) — Backend-aligned DTO interfaces and ambient Chrome runtime typings.
  - [ui](./ui/README.md) — Core design-system primitive components (`Screen`, `Input`, `Button`, `Text`, `RatingBar`, `ConfirmDialog`, etc.).
  - [utils](./utils/README.md) — Pure helpers for error classification, auth launch URL parsing, gloss normalization, sense ranking, and formatting.

## Invariants
- Release native builds (`!__DEV__` on iOS/Android) never fall back to `localhost:8080`; when `EXPO_PUBLIC_API_BASE_URL` is unset they resolve to `'https://pn.nacfson.cloud'` `[config.ts:resolveApiBaseUrl]`.
- Production builds never include `EXPO_PUBLIC_API_FALLBACK_URLS` in `API_BASE_URLS` `[config.ts:API_BASE_URLS]`.
- `webkitStyleFix.web.ts` always enforces light `document.documentElement.style.colorScheme = 'light'` on web and activates CSSOM mirroring only for AppleWebKit non-Chromium user agents (such as Tauri WKWebView) or explicit `localStorage` opt-in `[webkitStyleFix.web.ts:isWebKitNotChrome]`, `[webkitStyleFix.web.ts:shouldRun]`.

## Side Effects
- Evaluates `process.env.EXPO_PUBLIC_*`, `window.location.origin`, `Platform.OS`, and `Constants.expoConfig?.hostUri` at module load `[config.ts:resolveApiBaseUrl]`.
- On web, mutates `document.documentElement.style.colorScheme`, monkey-patches `CSSStyleSheet.prototype` and `CSSGroupingRule.prototype`, appends `<style id="rnw-webkit-style-mirror">` to `document.head`, and schedules `setTimeout` flush timers `[webkitStyleFix.web.ts:installStyleMirror]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

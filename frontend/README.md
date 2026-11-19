# Frontend (`frontend`)

## Overview
Expo / React Native / TypeScript client application for Project PN targeting Web, iOS, Android, and Tauri desktop. Coordinates root provider hierarchy (`SafeAreaProvider`, `ThemeProvider`, `AppLanguageProvider`), fail-closed startup authentication and onboarding gating, deep-link session handling, browser extension login relay, Expo web static export (`Dockerfile.web` + Nginx), and Tauri desktop packaging.

## Interface
- `[index.ts:registerRootComponent]` — App entrypoint importing `./src/webkitStyleFix` before registering `App` via `expo`'s `registerRootComponent`.
- `[App.tsx:default]` — Root `App` component wrapping `AppContent` in `SafeAreaProvider`, `ThemeProvider`, and `AppLanguageProvider`, gating between `LoadingScreen` (`AuthLoadingCard`), `OnboardingScreen`, `CentralAuthScreen`, and `AuthenticatedApp` (`LanguageProvider` -> `AddQueueProvider` -> `RootNavigator`).
- `[package.json:scripts]` — Workspace scripts for Expo web/iOS/Android (`web`, `web:export`, `ios:prod:*`), Tauri (`desktop:dev`, `desktop:build`), validation (`typecheck`, `test`, `lint:imports`, `lint:rntl-async`, `lint`).
- `[app.json:expo]` — Expo manifest (`name: "Project PN"`, `slug: "project-pn"`, `scheme: "projectpn"`, `userInterfaceStyle: "light"`, plugins `expo-localization`, `expo-secure-store`, `expo-web-browser`).
- `[Dockerfile.web:nginx]` — Production web container copying `dist/` to `/usr/share/nginx/web` and launching `nginx/docker-entrypoint.sh`.
- Subdirectories:
  - [nginx](./nginx/README.md) — Read-only-filesystem-compatible Nginx runtime entrypoint and reverse-proxy config template.
  - [src](./src/README.md) — Application TypeScript source, UI primitives, hooks, navigation, i18n, theme, API wrappers, and feature modules.
  - [src-tauri](./src-tauri/README.md) — Tauri v2 native desktop shell crate and window/deep-link configuration.

## Invariants
- `index.ts` imports `./src/webkitStyleFix` before `expo`/`App` so WebKit CSSOM mirroring installs prior to first style injection `[index.ts:registerRootComponent]`.
- `AppContent` fails closed on startup authentication: any `401` or backend connectivity failure sets `authState` to `'unauthenticated'` and clears `sessionStorage` on non-browser platforms without ever granting authenticated access `[App.tsx:AppContent]`.
- `AuthenticatedApp` activates `useSessionRenewal(true)` only when authenticated `[App.tsx:AuthenticatedApp]`.
- Unauthenticated deep-link URL events (`Linking.addEventListener('url', ...)`) are ignored on browser web and processed only on native/Tauri runtimes `[App.tsx:AppContent]`.

## Side Effects
- Tracks `session_started`, `auth_succeeded`, and `auth_failed` analytics events and flushes analytics on unmount `[App.tsx:AppContent]`.
- Calls `me()`, reads/writes `onboardingStorage` and `sessionStorage`, subscribes to `Linking` URL events and `onUnauthorized`, and relays extension login sessions via `sendSessionToExtension` `[App.tsx:AppContent]`.

## Verification
- Run: `npm test -w frontend && npm run typecheck -w frontend && npm run lint -w frontend`
- Web bundle check: `EXPO_PUBLIC_API_BASE_URL= npm run web:export -w frontend`

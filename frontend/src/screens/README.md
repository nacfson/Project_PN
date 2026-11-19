# Frontend Pre-Auth & Onboarding Screens (`frontend/src/screens`)

## Overview
Standalone top-level screens rendered outside the authenticated tab navigator: the platform sign-in entry screen (`CentralAuthScreen`, with Brand Pulse redirect/verifying states) and the first-run onboarding carousel (`OnboardingScreen`).

## Interface
- `[CentralAuthScreen.tsx:CentralAuthScreen]` — sign-in screen accepting `{ onTokenReceived?, connectionError? }` with phase state machine (`'idle' | 'redirecting' | 'verifying'`), rendering `AuthLoadingCard` during redirect/verification, initiating browser redirect login or native/Tauri `expo-web-browser` auth sessions, and displaying backend connectivity errors.
- `[OnboardingScreen.tsx:OnboardingScreen]` — 3-step onboarding walkthrough accepting `{ onComplete }` with step indicators, `Next`/`Get started` progression, and a `Skip` action on non-final steps.

## Invariants
- `CentralAuthScreen` navigates browser web directly to `${API_BASE_URL}/api/auth/login` while keeping `'redirecting'` active until navigation completes, resets `phase` to `'idle'` on browser bfcache `pageshow` (`event.persisted`), and on non-browser runtimes opens `${API_BASE_URL}/` with redirect URI `'projectpn://auth'` via `WebBrowser.openAuthSessionAsync` (transitioning to `'verifying'` while persisting session and awaiting `onTokenReceived`) `[CentralAuthScreen.tsx:CentralAuthScreen]`.
- `CentralAuthScreen` detaches `void handleSignIn()` from `Button.onPress` so async auth browser promises do not deadlock React Native press handling `[CentralAuthScreen.tsx:CentralAuthScreen]`.
- Raw `connectionError` diagnostic details are rendered only when `__DEV__` is true; production builds show only the generic localized `auth.connectionFailed` message `[CentralAuthScreen.tsx:CentralAuthScreen]`.
- `OnboardingScreen` displays `Skip` on slides `0` and `1` and switches the primary button from `onboarding.next` to `onboarding.getStarted` on the final slide (`step === 2`) `[OnboardingScreen.tsx:OnboardingScreen]`.

## Side Effects
- Subscribes to and removes a browser `window` `pageshow` listener on web `[CentralAuthScreen.tsx:CentralAuthScreen]`.
- Mutates `window.location.href` on browser web or opens an OS auth browser session via `WebBrowser.openAuthSessionAsync` on native/Tauri `[CentralAuthScreen.tsx:CentralAuthScreen]`.
- Persists extracted bearer sessions via `sessionStorage.setSession(session)` and awaits `onTokenReceived` `[CentralAuthScreen.tsx:CentralAuthScreen]`.
- Tracks `auth_started`, `auth_succeeded`, and `auth_failed` (`AUTH-101`) analytics events and logs exceptions via `console.error` `[CentralAuthScreen.tsx:CentralAuthScreen]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

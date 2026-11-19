# Auth Feature

## Overview
Contains authentication-related UI screens and components — including account merge confirmation, the Brand Pulse auth loading card, the visitor banner — alongside an in-memory event bus for notifying subscribers when the authenticated user's profile changes.

## Interface
- `AccountMergeScreen()` `[AccountMergeScreen.tsx:AccountMergeScreen]` — Settings stack screen (`SettingsStackParamList['AccountMerge']`) presenting source/target account merge warnings and confirming an account merge.
- `AuthLoadingCard({ title, onCancel?, slowThresholdMs? })` `[AuthLoadingCard.tsx:AuthLoadingCard]` and `AuthLoadingCardProps` `[AuthLoadingCard.tsx:AuthLoadingCardProps]` — Brand Pulse loading card rendered during sign-in redirects and session checks, showing animated concentric spinner rings (`progressbar` role on outer ring), localized keep-open/slow-wait subtitles, and an optional cancel/retry pill after `slowThresholdMs` (default `3500` ms).
- `GuestBanner({ onSignIn })` `[GuestBanner.tsx:GuestBanner]` — Compact visitor banner prompting unauthenticated users to sign in to sync vocabulary and reviews.
- `notifyAuthProfileChanged()` `[authProfileEvents.ts:notifyAuthProfileChanged]` — Broadcasts an auth profile change event to all registered listeners.
- `onAuthProfileChanged(listener)` `[authProfileEvents.ts:onAuthProfileChanged]` — Subscribes a `() => void` callback to auth profile change notifications and returns an unsubscribe function.

## Invariants
- `AccountMergeScreen` reads `sourceUserId`, `sourceEmail`, and `targetEmail` from `SettingsStackParamList['AccountMerge']` route params and executes the merge sequence strictly in order: `createMergeRequest` -> `confirmMergeRequest` -> `logout` `[AccountMergeScreen.tsx:AccountMergeScreen]`.
- `AuthLoadingCard` disables ring/halo animation loops when `useReducedMotion()` is `true`, resets `isSlow` on `onCancel`/`slowThresholdMs`/`title` changes, and mounts the slow-wait cancel pill (`auth-loading-cancel`) only when `onCancel` is supplied and `slowThresholdMs` elapses `[AuthLoadingCard.tsx:AuthLoadingCard]`.
- `onAuthProfileChanged` stores listeners in a module-level `Set<Listener>`, preventing duplicate registrations of the same function reference and ensuring idempotent unsubscribe cleanup `[authProfileEvents.ts:onAuthProfileChanged]`.

## Side Effects
- Executes sequential network API calls (`createMergeRequest`, `confirmMergeRequest`, `logout`) when the user confirms a merge `[AccountMergeScreen.tsx:AccountMergeScreen]`.
- Starts/stops React Native `Animated.loop` animations and a slow-wait `setTimeout` timer inside `AuthLoadingCard` `[AuthLoadingCard.tsx:AuthLoadingCard]`.
- Mutates the module-scoped `listeners` `Set` and synchronously invokes all subscribed callbacks when `notifyAuthProfileChanged` is called `[authProfileEvents.ts:notifyAuthProfileChanged]`, `[authProfileEvents.ts:onAuthProfileChanged]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

# Profile Feature

## Overview
Implements the Settings and Profile stack screens for inspecting account details and linked providers, managing language pairs (create, edit, activate, remove), tuning FSRS desired retention and daily XP goals, controlling streak vacation mode and freezes, switching app UI language, and logging out.

## Interface
- `ProfileScreen({ onLogout })` `[ProfileScreen.tsx:ProfileScreen]` — Root Settings screen grouping Account, Review (daily XP goal segmented control and desired retention stepper/slider), Streak (vacation mode toggle and streak freeze button), Appearance (app UI language `en`/`ko`), and Help/About/Log out rows.
- `LanguagePairsScreen()` `[LanguagePairsScreen.tsx:LanguagePairsScreen]` — Lists configured `UserLanguage` pairs from `LanguageContext`, supporting active-pair switching, editing, destructive removal with confirmation, and adding new pairs.
- `AddLanguagePairScreen()` `[AddLanguagePairScreen.tsx:AddLanguagePairScreen]` — Form screen to create a new target/display language pair with an optional "set active on add" toggle.
- `EditLanguagePairScreen()` `[EditLanguagePairScreen.tsx:EditLanguagePairScreen]` — Form screen (`SettingsStackParamList['EditLanguagePair']`) to update an existing target/display language pair.
- `ConnectedAccountsScreen()` `[ConnectedAccountsScreen.tsx:ConnectedAccountsScreen]` — Displays linked OAuth/identity providers returned by `getLinkedProviders()`.
- `GOAL_PRESETS` (`[100, 200, 300, 500]`) `[dailyGoal.ts:GOAL_PRESETS]`, `GoalOption` `[dailyGoal.ts:GoalOption]`, and `goalOptions(saved)` `[dailyGoal.ts:goalOptions]` — Builds sorted daily XP goal options, injecting a positive finite custom `saved` value when it is not in `GOAL_PRESETS`.

## Invariants
- `ProfileScreen` clamps desired retention to `[70, 97]` (`RETENTION_MIN`..`RETENTION_MAX`), converts it to a two-decimal ratio for `patchReviewSettings`, and rolls back optimistic UI state (`selectedGoalXp`, `retentionPercent`, `streakSettings`) if the corresponding PATCH request fails `[ProfileScreen.tsx:ProfileScreen]`.
- `ProfileScreen` treats an HTTP `401` logout response as already signed out and still invokes `onLogout()`, and `useStreakFreeze` blocks submission when `streak_freeze_tokens <= 0` `[ProfileScreen.tsx:ProfileScreen]`.
- `AddLanguagePairScreen` and `EditLanguagePairScreen` fall back to `SUPPORTED_LANGUAGES` if `getLanguageOptions()` returns empty allowlists, and map HTTP `409` or `"already exists"` errors to `settings.languagePairAlreadyExists` `[AddLanguagePairScreen.tsx:AddLanguagePairScreen]`, `[EditLanguagePairScreen.tsx:EditLanguagePairScreen]`.
- `EditLanguagePairScreen` navigates back without calling `updateLanguagePair` if neither `targetLanguage` nor `displayLanguage` changed (`!hasChanges`) `[EditLanguagePairScreen.tsx:EditLanguagePairScreen]`.
- `LanguagePairsScreen` ignores `handleSetActive` presses for the already-active `targetLanguage` `[LanguagePairsScreen.tsx:LanguagePairsScreen]`.
- `goalOptions` always returns options sorted ascending by `value` and never duplicates values already present in `GOAL_PRESETS` `[dailyGoal.ts:goalOptions]`.

## Side Effects
- Fetches and mutates backend state via `me`, `logout`, `getLinkedProviders`, `getLanguageOptions`, `addUserLanguage`, `updateLanguagePair`, `removeUserLanguage`, `getReviewSettings`, `patchReviewSettings`, `getStreakSettings`, and `patchStreakSettings` `[ProfileScreen.tsx:ProfileScreen]`, `[ConnectedAccountsScreen.tsx:ConnectedAccountsScreen]`, `[AddLanguagePairScreen.tsx:AddLanguagePairScreen]`, `[EditLanguagePairScreen.tsx:EditLanguagePairScreen]`, `[LanguagePairsScreen.tsx:LanguagePairsScreen]`.
- Refreshes or switches global `LanguageContext` (`refresh`, `setActive`), updates app UI language via `useAppLanguage().setLanguage`, invokes `onLogout`, and navigates within `SettingsStackParamList` `[ProfileScreen.tsx:ProfileScreen]`, `[LanguagePairsScreen.tsx:LanguagePairsScreen]`, `[AddLanguagePairScreen.tsx:AddLanguagePairScreen]`, `[EditLanguagePairScreen.tsx:EditLanguagePairScreen]`.
- Presents native `Alert.alert` confirmation and error dialogs on language-pair deletion `[LanguagePairsScreen.tsx:LanguagePairsScreen]`.
- Reads system clock (`new Date()`, computing UTC `+7` days for vacation mode), `navigator.userAgent`, `Platform.OS`, and window dimensions `[ProfileScreen.tsx:ProfileScreen]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

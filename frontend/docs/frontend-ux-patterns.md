# Frontend UX Patterns

This document collects recurring UX patterns for the Project PN React Native / Expo / Tauri frontend. Follow these patterns when adding or changing UI so the app stays consistent across mobile, web, and desktop.

## Input component

Use the shared `Input` component in `frontend/src/ui/Input.tsx` for all text fields. It already handles:

- `secureTextEntryToggle` — adds an eye icon to reveal/hide passwords.
- `loading` — shows a spinner inside the input (useful for async search fields).
- `error` + `helperText` — inline validation feedback below the input.
- `onClear` — a trailing clear button.

Do not build one-off password toggles, inline spinners, or validation wrappers. Extend `Input` instead.

## Form validation

- Show soft validation feedback after blur, not while the user is still typing.
- Use the `error` and `helperText` props on `Input`.
- Add translation keys for validation messages to both `en` and `ko` in `frontend/src/i18n/translations.ts`.

## Loading states

- Inputs that trigger async work should pass `loading` to show an inline spinner.
- Lists should keep showing stale data with an inline indicator while refreshing, rather than blanking out.
- Practice session transitions (loading due cards, submitting) already use `LoadingState`.

## Destructive actions

- For local destructive actions like clearing a passage, prefer an **undo** pattern over a blocking confirmation dialog.
- Store the previous value in a ref, show an undo control for ~3 seconds, and auto-dismiss it.

## Practice UX

- The answer input should auto-focus at the start of each card.
- Grading controls must work on both touch and pointer devices:
  - Scale the slider handle/track for desktop/web/Tauri.
  - Allow clicking the track to jump to a rating.
  - (Planned) keyboard shortcuts for web/desktop.

## OAuth / third-party sign-in

- If a provider is not configured, show a generic user-facing message such as "Google sign-in is not configured for this build."
- Show environment-variable hints **only** when `__DEV__` is true.

## Platform awareness

- Use `Platform.OS` and `isTauri()` to adapt controls for desktop/web (larger hit targets, keyboard shortcuts) versus mobile (touch, no hover).
- Test UI changes on both small mobile screens and the Tauri desktop window (default 1000×720).

## Safe Area

- Use `SafeAreaView` from `react-native-safe-area-context` for any content that touches the screen edges.
- Top-level banners/notifications that sit above the tab navigator should use `edges={['top', 'left', 'right']}` so they clear the status bar / notch / Dynamic Island.
- Bottom sheets and modals should account for the bottom safe-area inset (home indicator / gesture bar) using `useSafeAreaInsets`.
- Screens rendered inside a tab navigator that exclude `'bottom'` from their safe-area edges should add extra bottom padding to their `ScrollView` content so the last items are not hidden behind the tab bar.

## Translations

- Every new user-facing string needs a `TranslationKey` in `frontend/src/i18n/translations.ts`.
- Add the key to both English and Korean before opening a PR.

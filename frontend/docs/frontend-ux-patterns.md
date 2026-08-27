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

- Practice sessions use **private decks only** (user-added words). Optional `deckId` narrows to one deck; there is no curriculum / dictionary-pack practice mode.
- Select Words / sense pickers show a **single simple gloss** per option (e.g. `가지다`), not English definition plus localized paraphrase.
- Flashcards: front = lemma, back = chosen gloss only (no Explanation / Full meaning / Example as primary UX).
- The practice session supports two card modes:
  - **Flashcard mode**: the user taps the card to flip it and self-grades with the Anki-style answer buttons (Again/Hard/Good/Easy).
  - **Typing mode** (Deprecated): the user types the target word before revealing the answer. The probability of selecting typing mode has been set to zero across all stages to deprecate the input quiz, so all cards now default to Flashcard mode.
- The answer input should auto-focus at the start of each **typing** card. Flashcard cards do not auto-focus because they require a tap.
- Grading controls use four large answer buttons that mirror Anki (Again/Hard/Good/Easy). Each button displays the predicted next-review interval.
- After reveal, users can also **swipe the card to rate** (← Again, → Good, ↑ Easy, ↓ Hard). Keep the button bar as the accessible fallback.
- On mobile web, pin the typing answer bar and the grading/submit bar to the bottom of the viewport and **hide the tab bar** while they are visible. Do not leave rate/submit controls in normal document flow under the absolute tab bar — phone Chrome will cover them.
- Grade controls must work on both touch and pointer devices:
  - Scale buttons for desktop/web/Tauri.
  - Keyboard shortcuts 1/2/3/4 for web/desktop.
- Repeat review mode loads every non-archived learning item and includes example sentences so cloze prompts work the same as normal due reviews.
- Failed cards are requeued in the current session and stay recoverable after exit or refresh: `GET /api/reviews/due` returns unfinished Learning/Relearning items, and the practice UI marks `learning_stage === 'learning'` cards with the Retrying badge.

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

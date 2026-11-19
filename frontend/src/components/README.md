# Frontend Domain Components (`frontend/src/components`)

## Overview
Reusable feature-level UI components shared across Project PN screens, including sense selection bottom sheets, interactive passage tokenization, add-queue toast banners, pronunciation playback, deck/POS pickers, word status chips, and celebratory feedback animations.

## Interface
- `[Confetti.tsx:Confetti]` — full-screen pointer-events-none overlay animating 45 randomized confetti particles when `active` is true.
- `[CountUpText.tsx:CountUpText]` — animated integer counter text using quadratic ease-out on a 16ms interval (supports injected `_setInterval`/`_clearInterval` for tests).
- `[DeckSelector.tsx:DeckSelector]` — pressable deck selector row displaying the active deck name, loading spinner, or empty fallback.
- `[PosSelector.tsx:PosSelector]` — wrapping pill selector covering all `PosFilter` values (`'Any'`, `'noun'`, `'verb'`, `'adjective'`, `'adverb'`, `'pronoun'`, `'preposition'`, `'conjunction'`, `'interjection'`, `'determiner'`, `'phrase'`).
- `[QueueBanner.tsx:QueueBanner]` — safe-area status banner driven by `useAddQueue()` displaying pending count and dismissible per-job success/error toasts.
- `[SenseMeaning.tsx:SenseMeaning]` — displays a single normalized gloss via `displayGloss(option)` (returns `null` when no gloss exists).
- `[SensePicker.tsx:SensePicker]` — bottom-sheet `Modal` (`PAGE_WIDTH_FRAME`) for picking a dictionary sense, showing `closestToContext` badges, requesting missing source context before force-searching, and invoking `onConfirm`, `onForceExisting`, or `onForceWithPos`.
- `[SpeakButton.tsx:SpeakButton]` — circular TTS button playing word/sentence pronunciation via `expo-speech`.
- `[TappablePassage.tsx:TappablePassage]` — interactive tokenized text view supporting single-word selection and two-tap phrase-span selection; also exports `[TappablePassage.tsx:PassageSpan]`, `[TappablePassage.tsx:tokenize]`, `[TappablePassage.tsx:wordTokensOf]`, and `[TappablePassage.tsx:spanFromWordRange]`.
- `[WordChip.tsx:WordChip]` / `[WordChip.tsx:WordStatus]` — status-colored removable chip for `'idle' | 'pending' | 'added' | 'error'` states.

## Invariants
- `Confetti` renders `null` when `!active` or `reduced` motion is enabled; `CountUpText` jumps immediately to `target` when `reduced` is true or `duration <= 0` `[Confetti.tsx:Confetti]`, `[CountUpText.tsx:CountUpText]`.
- `QueueBanner` renders `null` when `pendingCount === 0` and no undismissed completed/errored jobs exist; `'done'` toasts auto-dismiss after `2500ms` `[QueueBanner.tsx:QueueBanner]`, `[QueueBanner.tsx:ToastItem]`.
- `SensePicker` blocks closing (`handleClose`) and disables actions while `isConfirming` is true, pre-selects `bestMatch(options)` (or `options[0]`) when opened, and requires non-empty context before calling `onForceExisting` or revealing the `CONCRETE_POS` picker `[SensePicker.tsx:SensePicker]`.
- `SpeakButton` enforces a `44x44` hit target on phone layouts (`shellLayout === 'bottom'`) and `32` or `36` on wider layouts `[SpeakButton.tsx:SpeakButton]`.
- `TappablePassage` stores the in-progress phrase anchor in `anchorRef` so two rapid taps complete a span even before React re-renders, and normalizes word spans with `lo = Math.min(start, end)` to `hi = Math.max(start, end)` `[TappablePassage.tsx:TappablePassage]`, `[TappablePassage.tsx:spanFromWordRange]`.

## Side Effects
- Starts/stops React Native `Animated` loops (`Confetti`) and `setInterval`/`setTimeout` timers (`CountUpText`, `QueueBanner`) `[Confetti.tsx:Confetti]`, `[CountUpText.tsx:CountUpText]`, `[QueueBanner.tsx:ToastItem]`.
- Triggers native light haptic feedback (`Haptics.impactAsync` on non-web) and invokes OS speech synthesis (`Speech.stop()` + `Speech.speak(...)`) `[SpeakButton.tsx:SpeakButton]`.
- Consumes `useAddQueue()`, `useTheme()`, `useAppLanguage()`, and `useSafeAreaInsets()` contexts `[QueueBanner.tsx:QueueBanner]`, `[SensePicker.tsx:SensePicker]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

# Frontend UI Primitives (`frontend/src/ui`)

## Overview
Core design-system UI primitive library consumed across all screens and feature modules. Provides typography (`Text`), buttons, inputs, cards, badges, chips, switches, segmented controls, dialogs, settings rows, review rating bars, state placeholders, motion wrappers, and the scroll-aware `Screen`/`PageColumn` layout shell.

## Interface
- `[index.ts:exports]` — barrel re-exporting all UI primitives (`AnimatedProgressBar`, `Badge`, `Button`, `Card`, `Chip`, `CinematicCard`, `ConfirmDialog`, `ContextualCommandBar`, `EmptyState`, `ErrorState`, `HoverReveal`, `Icon`, `Input`, `Kbd`, `LoadingState`, `PageColumn`, `RatingBar`, `RatingButton`, `Screen`, `SegmentedControl`, `SelectableCard`, `SettingsGroup`, `SettingsRow`, `ShellChromeContext`, `SkeletonCard`, `StaggeredList`, `Switch`, `TabBarScrollContext`, `Text`, `useShellChrome`, and types `ConfirmDialogProps`, `Rating`, `RatingButtonProps`).
- `[Text.tsx:Text]` / `[Text.tsx:TextVariant]` / `[Text.tsx:TextColor]` / `[Text.tsx:TextProps]` — themed text component with semantic variants, legacy aliases, Hangul-aware font selection, and tabular numerals.
- `[Button.tsx:Button]` / `[Button.tsx:ButtonVariant]` / `[Button.tsx:ButtonSize]` / `[Button.tsx:ButtonProps]` — pressable CTA button (`primary`, `secondary`, `quiet`, `link`, `danger`, plus legacy `tonal`/`outline`/`ghost` aliases) with loading spinner, icons, web focus ring, and optional haptics.
- `[Input.tsx:Input]` / `[Input.tsx:InputProps]` — `forwardRef` `TextInput` supporting `default`/`display` variants, `leading`/`trailing` slots, `loading`, `error`, `helperText`, `onClear`, and `secureTextEntryToggle`.
- `[Screen.tsx:Screen]` / `[Screen.tsx:PageColumn]` / `[Screen.tsx:TabBarScrollContext]` / `[Screen.tsx:ShellChromeContext]` / `[Screen.tsx:useShellChrome]` — safe-area screen wrapper with Reanimated scroll-linked collapsing headers, tab-bar hide/show signaling, bounded container mode, and responsive `PageColumn`.
- `[Card.tsx:Card]` / `[CinematicCard.tsx:CinematicCard]` / `[SelectableCard.tsx:SelectableCard]` — surface containers (optional iOS `BlurView` glass, hover-revealed actions, radio-selectable state).
- `[ConfirmDialog.tsx:ConfirmDialog]` — accessible modal confirmation dialog with backdrop dismiss, `Escape` shortcut, and web cancel-button autofocus.
- `[ContextualCommandBar.tsx:ContextualCommandBar]` — floating bottom action bar rendered for multi-select batches.
- `[RatingBar.tsx:RatingBar]` / `[RatingBar.tsx:scoreFromRating]` / `[RatingButton.tsx:RatingButton]` — 4-choice spaced-repetition rating bar (`again: 0`, `hard: 1`, `good: 2`, `easy: 3`) with desktop `1`–`4` `Kbd` hints and compact mobile layout.
- `[Badge.tsx:Badge]` / `[Chip.tsx:Chip]` / `[Icon.tsx:Icon]` / `[Kbd.tsx:Kbd]` / `[SegmentedControl.tsx:SegmentedControl]` / `[SettingsGroup.tsx:SettingsGroup]` / `[SettingsGroup.tsx:SettingsRow]` / `[Switch.tsx:Switch]` — form, navigation, and metadata primitives.
- `[AnimatedProgressBar.tsx:AnimatedProgressBar]` / `[HoverReveal.tsx:HoverReveal]` / `[SkeletonCard.tsx:SkeletonCard]` / `[StaggeredList.tsx:StaggeredList]` — animated progress, hover-reveal, shimmer skeleton, and staggered entrance wrappers.
- `[EmptyState.tsx:EmptyState]` / `[ErrorState.tsx:ErrorState]` / `[LoadingState.tsx:LoadingState]` — centered placeholder state views.

## Invariants
- `AnimatedProgressBar` clamps `percent` to `[0, 100]` and updates synchronously without spring animation when `reduced` motion is enabled `[AnimatedProgressBar.tsx:AnimatedProgressBar]`.
- `Button` maps legacy variants (`tonal`/`outline` -> `secondary`, `ghost` -> `quiet`), disables interaction while `loading` is true, and adds `hitSlop` when button height `< 48` `[Button.tsx:Button]`.
- `Card` mounts `expo-blur` `BlurView` only when `glass` is true and `Platform.OS === 'ios'` `[Card.tsx:Card]`.
- `ConfirmDialog` returns `null` when `!visible`, constrains width via `PAGE_WIDTH_FRAME`, binds `Escape` to `onCancel` while visible, and focuses the cancel button on web open `[ConfirmDialog.tsx:ConfirmDialog]`.
- `ContextualCommandBar` returns `null` when `selectedCount === 0` `[ContextualCommandBar.tsx:ContextualCommandBar]`.
- `HoverReveal` always renders at `opacity: 1` on non-web platforms, bottom-shell layouts, or viewports `< 720px` `[HoverReveal.tsx:HoverReveal]`.
- `Kbd` returns `null` unless `Platform.OS === 'web'` and `shellKind === 'browser'` `[Kbd.tsx:Kbd]`.
- `Screen` renders a non-scrolling bounded `View` when `!scrollEnabled && !as && !title`; otherwise it wraps content in `as || Animated.ScrollView` and drives `tabBarTranslateY` after `> 40px` downward scroll past `y > 50` `[Screen.tsx:Screen]`.
- `SkeletonCard` and `StaggeredList` suppress looping/stagger animations when `useReducedMotion()` is true `[SkeletonCard.tsx:SkeletonCard]`, `[StaggeredList.tsx:StaggeredList]`.
- `Text` applies `tabular-nums` automatically for `variant === 'stat'` or `tabular === true`, and resolves display/mono/ui font families via `fontFamilyFor` `[Text.tsx:Text]`.

## Side Effects
- Triggers native light haptics (`Haptics.impactAsync`) on `Button` press-in when `haptic` is true and `Platform.OS !== 'web'` `[Button.tsx:Button]`.
- Drives React Native `Animated` and `react-native-reanimated` animations (`AnimatedProgressBar`, `HoverReveal`, `Screen`, `SkeletonCard`, `StaggeredList`) `[Screen.tsx:Screen]`, `[SkeletonCard.tsx:SkeletonCard]`, `[StaggeredList.tsx:StaggeredList]`.
- Mutates DOM focus on web inside `ConfirmDialog` and registers `Escape` via `useKeyboardShortcut` `[ConfirmDialog.tsx:ConfirmDialog]`.
- Reads `navigator.userAgent` and window dimensions to adapt layout and keyboard hints (`HoverReveal`, `Kbd`, `RatingBar`, `PageColumn`) `[Kbd.tsx:Kbd]`, `[RatingBar.tsx:RatingBar]`, `[Screen.tsx:PageColumn]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

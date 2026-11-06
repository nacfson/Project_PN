# Research: Polished Design Refresh

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-05

The spec has no open clarifications; all four were resolved on 2026-11-05. This document resolves the technical unknowns found while planning. Each entry gives the decision, the rationale and the alternatives considered.

---

## R1. Theme architecture: one light theme behind a stable hook

**Decision**:
- Rewrite `frontend/src/theme/tokens.ts` as one light token set: semantic color tokens, the stage ramp, type roles, spacing, radii and control heights ([contract](contracts/design-tokens.md)).
- Keep the `useTheme()` hook and the `{ colors, spacing, radii, typography, motion, reduced, shadows, iconSizes }` shape, so the 59 consumers keep compiling.
- During migration, expose a **legacy alias map** on `colors` that maps old Material-style names (`primary`, `outlineVariant`, `surfaceContainerLow`, `onSurface`, and so on) to the new palette. Every screen then turns light in the first commit.
- Each story migrates the files it touches to semantic names. The Polish phase deletes the alias map once a search finds no legacy names (SC-008).

**Rationale**:
- Rewriting 59 files in one change is risky and hard to review.
- The alias map makes the foundation commit visually coherent at once, avoiding a half-dark, half-light app.
- It also lets each story PR stay focused on its screen.

**Alternatives considered**:
- *Big-bang rename of all call sites*: rejected because the diff would be huge and would conflict with parallel work.
- *Keep Material names permanently*: rejected because the names (`surfaceContainerHighest`, `onSecondaryContainer`) don't describe the new system and invite drift.

**Alias semantics (important)**:
- Legacy `primary` was the brand indigo used for icons, links, highlights and buttons. It aliases to **accent** (`#2846C4`), not to the near-black primary-action fill.
- Restyled `Button variant="primary"` uses the new `primary` token (`#17181B`) directly.
- This keeps un-migrated screens readable without turning every icon black.

## R2. Removing dark mode completely

**Decision**:
- Delete `md3Dark`, `visualVariations`, `ThemeVariation`, `ThemeMode`, `setMode`, `toggleMode`, `variation` and `setVariation`.
- Remove their three UI entry points:
  - the dark-mode switch in `ProfileScreen`;
  - the theme action in `features/web/CommandDock.tsx`;
  - the variation picker in `HomeScreen`, which is rewritten anyway.
- `Card.tsx` uses blur `tint="light"`.
- `App.tsx` renders `<StatusBar style="dark" />`, meaning dark content on the light canvas.
- Platform chrome:
  - `app.json` already sets `userInterfaceStyle: "light"`; verify only.
  - Web: set `document.documentElement.style.colorScheme = 'light'` in the existing web-only side-effect module `src/webkitStyleFix.web.ts`, so form controls and scrollbars render light even when the OS is dark.
  - Tauri: set the window `"theme": "Light"` in `src-tauri/tauri.conf.json`.
- Storage: remove `themeModeStorage` and `themeVariationStorage` from `api/storage.ts` and add a one-shot `clearLegacyThemePreferences()`. It deletes `project_pn_theme_mode` and `project_pn_theme_variation` from localStorage or SecureStore when `ThemeProvider` mounts, ignores failures, and never blocks render.

**Rationale**:
- Today the **product default is the dark `bentoIndigo` variation**, so most users currently see dark UI. Leaving any path back to it would contradict FR-033 and SC-011.
- Explicitly clearing the keys makes stale preferences harmless and removes dead state.

**Alternatives considered**:
- *Keep the keys but ignore them*: rejected because dead data invites someone to wire it back up.
- *Keep `setMode` as a no-op*: rejected because SC-011 requires zero theme-toggle references.

## R3. Fonts: loading and Korean fallback

**Decision**:
- **Packages**: add `@expo-google-fonts/geist` (400/500/600), `@expo-google-fonts/geist-mono` (400), `@expo-google-fonts/newsreader` (400/500) and `@expo-google-fonts/ibm-plex-sans-kr` (400/500/600). All are SIL OFL and are installed with `npx expo install` so versions align with SDK 56. If a package is missing for this SDK, vendor the OFL `.ttf` files under `frontend/assets/fonts/` with their license texts. The family names in `theme/fonts.ts` stay the same either way.
- **New module `theme/fonts.ts`** exports:
  - the family-name constants (`ui`, `uiMedium`, `uiSemibold`, `display`, `displayMedium`, `mono`, `korean*`);
  - the `useFonts` map;
  - `fontFamilyFor(role, weight, text?)`.
- **Web**: `fontFamily` is passed through to CSS, so use stacks: `"Geist, 'IBM Plex Sans KR', system-ui, sans-serif"`, `"Newsreader, Georgia, serif"` and `"'Geist Mono', ui-monospace, monospace"`. Register faces with `display: FontDisplay.SWAP` so text is never invisible (SC-009). Browsers fetch a fallback face only when an earlier face lacks the glyphs, so English-only pages never download the Korean font.
- **Native** (iOS/Android) has no font stacks. Geist has no Hangul, so the shared `Text` primitive picks the Korean family when its string content contains Hangul (`/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/`). A `lang="ko"` prop forces the Korean family for mixed or nested content.
- **Render gating**:
  - Web: stop returning `null` while fonts load (the current `ThemeProvider` behavior) and render immediately with fallback stacks.
  - Native: keep the current behavior. The provider renders nothing until fonts are loaded, which usually takes well under a second right after the launch image. No new dependency (such as `expo-splash-screen`) is added.
- **Inter**: remove `@expo-google-fonts/inter` in Polish once no references remain.

**Rationale**:
- Expo Google Fonts is already the project's pattern (Inter).
- Font stacks give correct per-glyph fallback on web for free.
- On native, Hangul detection is the simplest way to make Korean meanings use the companion face consistently instead of the OS default.

**Alternatives considered**:
- *System Korean font on native* (Apple SD Gothic Neo / Noto Sans CJK): smaller binary, but violates the spec edge case requiring the Korean companion face. Kept as a fallback only if the bundle-size review rejects Plex KR.
- *Load fonts from the Google Fonts CDN at runtime*: rejected because it fails offline, adds a third-party request, and is inconsistent with the bundled Inter approach.

## R4. Navigation shell: sidebar vs bottom bar

**Decision**:
- **One custom tab bar, two layouts**:
  - `MainTabs` keeps the custom `tabBar` and, for the browser shell when `browserPageWidth(window) ≥ 720`, sets `tabBarPosition: 'left'` (supported in bottom-tabs v7) and renders the new `Sidebar`.
  - Otherwise it renders the restyled `BottomBar`.
  - The phone shell (`shellKind === 'phone'`) always uses `BottomBar`.
- **Order and labels**: destinations are Today, Words, Add, Practice, Settings. The route name stays `Learn` and only the label changes to "Today" (`tabs.today`), so deep links, `linkingConfig`, analytics and tests keep working.
- **Sidebar content**:
  - The "PN" mark in the display face, linking to Today.
  - Nav items with a 36 px height.
  - The active language pair at the bottom, from the existing user-languages data. The label is display-only.
- **Chrome hiding**: extend `TabBarScrollContext` in `ui/Screen.tsx` with `chromeHidden` and `setChromeHidden(boolean)`.
  - `PracticeScreen` sets it to `true` while `status === 'active'` and `false` on unmount or end.
  - Both layouts render nothing when it is hidden. The existing bottom-bar translate and interactivity logic for grading chrome is replaced by this one flag.
- **Content column**: a shared `PageColumn` wrapper (or a prop on `Screen`) applies `maxWidth: 760`, centers the column, and pads 56/32/80 on wide pages and 20 px on phones.

**Rationale**:
- Reuses the existing custom tab bar and navigator, so there is no new navigator or route churn.
- A single chrome flag is simpler than the current scroll-linked translate plus the separate interactivity toggle, and it satisfies FR-015 on both shells.

**Alternatives considered**:
- *Drawer navigator for desktop*: rejected because it adds a second navigator and different back behavior.
- *Rename the route to `Today`*: rejected because it churns links and tests for a label-only change.

**`DESIGN.md` overlay rule**: unchanged in substance. The "main UI" is still the `BrowserFrame` page, which now contains the sidebar plus the content column, so overlays keep using `PAGE_WIDTH_FRAME`. The `DESIGN.md` update documents this.

## R5. Correct-only session progress

**Decision**:
- **Add pure functions to `features/practice/practiceItemState.ts`** ([contract](contracts/session-progress.md)):
  - `PASSING_SCORE_THRESHOLD = 0.75` and `isPassingScore(score)`. This is the single source used for the attempt's `is_correct`, for `shouldRetry = !isPassingScore(score)` and for progress (FR-015c). Today these are two separate inline `>= 0.75` / `< 0.75` checks.
  - `sessionProgress({ attempts, dueIds })`, which returns `{ completed, current, total, percent }`:
    - `completed` is the number of distinct `dueIds` with at least one attempt where `is_correct === true`.
    - `total` is `max(dueIds.length, 1)`.
    - `current` is `min(completed + 1, total)`.
    - `percent` is `floor(completed / total × 100)`.
- **Wiring in `PracticeScreen`**: use `sessionProgress()` for both the progress bar and the "X of N" counter, replacing `practiceCardProgress()` and the inline `dueItemsReviewedCount`, which counted every attempt in normal mode. Repeat mode uses the same function. Its queue refills with reshuffled due items, but attempts outside `dueIds` or repeated correct answers don't add progress.
- **Retire `practiceCardProgress`**: remove it and its tests, replaced by `sessionProgress` tests covering the same unique-card behavior plus the correct-only cases.

**Rationale**:
- Rating scores are `again 0 / hard 1 / good 2 / easy 3`, so with the existing 0.75 threshold only Forgot fails, matching the spec ("Correct means Hard, Good, or Easy").
- Deriving progress from the same `is_correct` field that is sent to the server keeps the UI, the retry queue and the history consistent.
- Because failed cards are re-inserted until passed, `percent === 100` happens exactly when the queue completes.

**Alternatives considered**:
- *Count queue position*: rejected because it advances on failures, which is today's bug.
- *Count only first-try-correct cards*: rejected because a fail-then-correct card would never count, so progress could never reach 100%.
- *Count from `rating_score >= 2`* (Good or Easy only): rejected because it diverges from the retry rule (Hard does not retry), breaking FR-015c.

## R6. Today data and derivations

**Decision**:
- Today reads the existing `getStatsSummary()` plus one new call to the existing `getDueLearningItems(5)` wrapper for "Up next". Both stay in `frontend/src/api/`.
- Pure helpers live in `features/learn/todaySummary.ts`:
  - `estimateMinutes(due) = max(1, ceil(due × 30 / 60))` (16 cards → 8 minutes).
  - `totalWords(stage_counts)`: the sum of all stages.
  - `nextReviewAfterToday(forecast, today)`: the first forecast date after today with `count > 0`, or `null` (shown as "none yet").
  - `xpToday = reviews_today × XP_PER_REVIEW (10)`, as the current Home already computes.
  - `dueMixNote(upNextItems, due)`: chooses between "all new", "mostly reviews" and "a mix".
  - `remaining = max(0, due_today − upNext.length)`, shown as "and N more".
- The mastery bar uses `stage_counts` in ramp order. With zero total it renders an empty track and a "No words yet" legend state (spec edge case).

**Rationale**: Every value comes from existing endpoints (FR-038), and keeping the derivations pure makes them unit-testable.

**Alternatives considered**: *A new backend "today" endpoint*: rejected because it is out of scope (no API change).

## R7. Words: deck filter menu and separate Decks view

**Decision**:
- `WordsStack` gains a `Decks` route (`DecksScreen`), and `WordsRoot` accepts an optional `{ deckId?: string }` param.
- `MyWordsScreen` drops the inline `DeckCanvas` and gains `DeckFilterMenu`, which offers "All decks", each deck with its count, "New deck" and "Manage decks". On phones it opens as a bottom sheet (respecting `PAGE_WIDTH_FRAME`); on web and desktop it is an anchored menu.
- `DecksScreen` hosts the existing `DeckCanvas`/`DeckList`, `DeckFormModal` (create, rename, delete non-default) and multi-select delete. Opening a deck navigates to `WordsRoot` with `{ deckId }`.
- Word rows use a responsive grid: Word+IPA, Meaning, Type, Stage, Due. Below 720 px the row collapses to Word and Stage.
- Pointer devices get hover actions through the existing `HoverReveal`: audio via `SpeakButton`, move via `MoveToDeckModal`, and delete. Touch devices reach the same actions in `WordDetailScreen`.
- **Removal guard (clarification #5)**: every removal entry point opens a new shared `ui/ConfirmDialog` ("Remove this word? This can't be undone." with Cancel and a danger Remove) before calling the existing `archiveLearningItem`/`archiveLearningItems`. The entry points are the row action (`MyWordsScreen` line ~460), bulk removal (~795) and word detail. Bulk removal states the count. `Alert.alert` is not used because it does nothing on react-native-web. The dialog is an in-app modal whose surface uses `PAGE_WIDTH_FRAME` (`DESIGN.md` overlay rule). Today's removal has no undo, so confirmation is the only safeguard.
- `/` focuses search via `useKeyboardShortcut`.

**Rationale**: Implements clarification #2 while reusing every existing deck component and API (`createDeck`, `renameDeck`, `deleteDeck`, `moveItemsToDeck`).

**Alternatives considered**: *A modal-only deck manager*: rejected because a stack route gives proper back navigation and deep-linkability.

## R8. Settings: grouped rows and goal presets

**Decision**:
- Restyle `ProfileScreen` with new `SettingsGroup`/`SettingsRow` primitives, in the order Account, Review, Streak, Appearance (app language only), then Help/About/Log out.
- Daily goal becomes a segmented radio group with options 100, 200, 300 and 500. If the saved `daily_goal_xp` is not a preset, a fifth segment shows that value (for example "250") as selected until another preset is chosen (FR-032).
- Retention uses the existing slider (70–97), saving on release with a debounce.
- Every control saves on change through the existing `patchReviewSettings` and streak-settings calls. On failure it reverts to the last saved value and shows the existing translated `*SaveFailed` message inline (FR-031).

**Rationale**: Uses the existing APIs and translation keys and avoids adding validation surface.

**Alternatives considered**: *Free numeric input* (current): rejected because the design specifies presets.

## R9. Keyboard shortcuts and hint chips

**Decision**:
- **Hook**: `hooks/useKeyboardShortcut(key, handler, { enabled })` attaches a `window` `keydown` listener only when `Platform.OS === 'web'`. It ignores events while an `INPUT`, `TEXTAREA` or contenteditable element is focused, matching the existing PracticeScreen guard, and removes itself on unmount.
- **Bindings**:
  - Today: Enter starts the review.
  - Add: Enter is native submit on the input.
  - Words: `/` focuses search.
  - Practice: keeps its handler (Space or Enter to reveal, 1–4 to rate), refactored onto the hook.
- **`Kbd` chip**: renders only when a physical keyboard is expected, meaning `Platform.OS === 'web'` and the browser shell. Tauri runs on web, so it is included. Phones get no chip (FR-036).

**Rationale**: Centralizes the input-focus guard and platform check that today exist only inside PracticeScreen.

**Alternatives considered**: *Per-screen listeners*: rejected because the guard logic would be duplicated and inconsistent.

## R10. Gloss-only card and meaning picker

**Decision**:
- `Flashcard` back: verify it renders only `displayGloss(...)`, with the personal-note precedence and the "Your meaning" caption, and restyle it. No definition or example is added.
- `SensePicker`: becomes a `SelectableCard` list showing the simple gloss, plus part of speech and CEFR as small labels. The example sentence line is removed (FR-024). The "Closest to your sentence" badge, "None of these — search again" (`force: true`) and "Add best match" behaviors are unchanged.
- `frontend-ux-patterns.md` gets a short note that the picker no longer shows an example.

**Rationale**: Implements clarification #1 and keeps the documented rule authoritative.

## R11. Accessibility and contrast

Contrast was computed with WCAG 2.1 relative luminance. The same pairs become assertions in `frontend/src/theme/tokens.test.ts` (R12), which then serves as the canonical check.

| Pair | Ratio | Need | Result |
|---|---|---|---|
| Text `#17181B` on canvas / surface | 16.40 / 17.75 | 4.5 | PASS |
| Text secondary `#4A4C53` on surface | 8.57 | 4.5 | PASS |
| Text muted `#5E6068` on canvas / surface / fill | 5.79 / 6.27 / 5.29 | 4.5 | PASS |
| Accent `#2846C4` on canvas / surface | 7.02 / 7.60 | 4.5 | PASS |
| White on primary / primary hover | 17.75 / 13.19 | 4.5 | PASS |
| Danger `#B42318` on surface | 6.57 | 4.5 | PASS |
| Success `#1E7A46` (derived) on surface | 5.35 | 4.5 | PASS |
| Warning `#8A5300` (derived) on surface | 6.33 | 4.5 | PASS |
| Control border `#D9D9D3` on surface | **1.42** | 3.0 | **FAIL** |
| Control border hover `#B9BAB4` on surface | **1.95** | 3.0 | **FAIL** |
| Proposed `controlBorderStrong` `#8C8D88` on surface | 3.34 | 3.0 | PASS |
| Stage New / Learning swatches on surface | 1.71 / 1.99 | 3.0 | exempt (always paired with a text label) |

**Decision (needs product sign-off; listed as an SC-001 deviation)**:
- Components whose boundary is the only thing that identifies them as interactive use `controlBorderStrong` (`#8C8D88`): text inputs, the search field, the switch's off-track outline, the slider track and unselected radio outlines.
- Outlined buttons, settings groups, selectable cards and dividers keep the design's lighter values. Their visible text labels and contents identify them, so WCAG 1.4.11 does not require boundary contrast there.
- Stage swatches keep the ramp. They are decorative next to their stage label.
- Focus rings use accent `#2846C4` at 2 px (7.60:1).
- Success and warning are not in the design. They were derived for existing badges (Retrying, sync states) and pass AA.

**Rationale**: SC-004 explicitly requires 3:1 for UI component boundaries. This keeps the design's quiet look everywhere except the few controls where it matters.

**Alternatives considered**:
- *Use the design's border everywhere*: fails SC-004.
- *Darken all borders*: loses the design's character for no accessibility gain.

Other accessibility work:
- `accessibilityRole` for progressbar (with value), radiogroup/radio, tablist/tab and switch.
- Touch targets of at least 44 px through `hitSlop` where the visual size is smaller (32 px tabs, 36 px nav items).
- `Kbd` chips are hidden from screen readers (`accessibilityElementsHidden`/`aria-hidden`).

## R12. Verification strategy

**Decision**:
- **Unit tests (Jest)**:
  - `tokens.test.ts`: every text/background pair in the contract meets its threshold (SC-004).
  - `practiceItemState.test.ts`: the `sessionProgress` vectors (SC-012).
  - `todaySummary.test.ts`.
  - `ThemeProvider.test.tsx`: stored dark keys are cleared and ignored, there is no `setMode` on the context, and web renders without waiting for fonts.
- **Component tests (RNTL)**:
  - Shell: a 1200-wide browser shell renders the sidebar; the phone shell renders the bottom bar; neither renders while a session is active.
  - `AddScreen.test.tsx`: unchanged assertions on `tab-manual` and `manual-add-input-wrapper`, with the label assertion updated to "Word or phrase" (SC-006).
  - Settings: goal presets, the custom value preserved, no theme row.
  - Words: deck filter → Manage decks navigates to `Decks`.
  - Practice: Forgot does not advance the counter.
- **Static guards** (a Jest test scanning `frontend/src`, failing on matches):
  - `md3Dark`, `bento`, `toggleMode`, `setMode(`, `ThemeVariation` and `themeModeStorage` (SC-011).
  - Raw hex literals outside `theme/` and an allowlist (SC-008), enabled in Polish once the alias map is deleted.
- **Manual visual review**: `local-ui-verify` at 1440×960 and 390×844 against `design/*.html`, with deviations recorded per SC-001.
- **Gate**: `npm run verify:full`.

**Rationale**: Turns each success criterion into an automated check where possible, and leaves only visual fidelity to manual review.

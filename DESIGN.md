# Design Rules

Rules that keep the Project PN interface consistent. Recurring UX behavior (validation, loading, practice) lives in `frontend/docs/frontend-ux-patterns.md`.

## Visual system

- **Light-only palette (`frontend/src/theme/tokens.ts`):** Warm paper canvas (`#F6F6F3`), crisp white surface (`#FFFFFF`), ink text (`#17181B`), royal blue accent (`#2846C4`), hairline borders (`#E4E4DF`), and monochromatic blue-depth stage progression (`new` `#C4C6CC` → `mastered` `#172C85`). Dark mode and theme variations are retired.
- **Typography (`frontend/src/theme/fonts.ts`):**
  - **Geist** (`--font-sans`) for UI chrome, controls, labels, and tabular numeric metrics.
  - **Newsreader** (`--font-display`) for English word lemmas on flashcards (`cardLemma`), word lists (`listLemma`), and display inputs (`inputDisplay`).
  - **IBM Plex Sans KR** (`--font-ko`) for Korean localized glosses (`meaning`) and Korean UI copy.
  - **Geist Mono** (`--font-mono`) for IPA transcriptions (`ipa`) and keyboard shortcut badges (`kbd`).
- **Elevation:** Prefer `1px` hairline borders (`colors.hairline` / `colors.controlBorder`) over drop shadows. Only active segmented pills (`shadows.segment`) and compact floating controls use a subtle `0 1px 2px rgba(23, 24, 27, 0.08)` shadow.

## Navigation shell

- **Four top-level destinations:** `Today` (`TodayScreen`), `Add` (`AddScreen`), `Words` (`WordsStack`: `MyWordsScreen` + `DecksScreen` + `WordDetailScreen`), and `Settings` (`SettingsStack`).
- **Responsive shell (`frontend/src/navigation/shellKind.ts`):**
  - **Sidebar layout** (`width >= 720` on web/desktop): Fixed `232px` left sidebar (`SidebarShell`) + centered `760px` max-width main page column (`BROWSER_PAGE_MAX_WIDTH = 760`).
  - **Bottom bar layout** (`width < 720` or native iOS/Android): Compact bottom tab bar (`BottomTabBar`, `minHeight: 52`) + single-column page.
- **Focus mode (`ShellChromeContext`):** During an active review session (`Review` screen with `status === 'active'`), navigation chrome (sidebar or bottom bar) is hidden via `setChromeHidden(true)` so only the review header, flashcard, and rating bar are visible.

## Overlays stay within the main UI's width

**Rule:** Bottom sheets, dialogs, and other overlay surfaces must never extend beyond the width of the main UI. Only a dimming backdrop may span the full window.

The main UI is the page rendered by `BrowserFrame` (`frontend/src/navigation/browserFrame.tsx`), capped at `BROWSER_PAGE_MAX_WIDTH` (`760px`, `frontend/src/navigation/shellKind.ts`). On wide browsers where the `232px` sidebar is visible, overlays center within the main page column using `PAGE_WIDTH_FRAME` (`width: '100%', maxWidth: 760, alignSelf: 'center'`).

**Why this needs care:** on web, React Native's `Modal` renders through a portal on `document.body`, outside `BrowserFrame`. An overlay inside a `Modal` does not inherit the page's width cap, and a flex child stretches to fill the window by default.

**How to apply:** spread `PAGE_WIDTH_FRAME` into the overlay's surface style, not its backdrop:

```ts
sheet: {
  ...PAGE_WIDTH_FRAME,
  paddingHorizontal: 20,
},
```

**How it is enforced:** add each new bottom sheet or modal dialog (`SensePicker`, `ChangeMeaningSheet`, `DeckFormModal`, `MoveToDeckModal`, `DeckFilterMenu`, `ConfirmDialog`) to `frontend/src/components/bottomSheetWidth.test.tsx`, with `testID="bottom-sheet"` (or its registered dialog `testID`) on its surface.

# Implementation Plan: Polished Design Refresh

**Branch**: `005-design-refresh` (spec directory only; work currently lives on `main`) | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-design-refresh/spec.md` and the reference boards in [`design/`](design/)

## Summary

Re-skin the Expo / React Native client to the new editorial design. The work has six parts:

- **Light-only theme.** One light theme: warm canvas, near-black primary actions, a cobalt accent, a six-step stage ramp, and three type roles (Geist UI with IBM Plex Sans KR, Newsreader display, Geist Mono). The dark palette, the "bento" variations and the theme toggle are deleted. The `useTheme()` hook keeps its shape for call sites, so the 59 consumers migrate gradually.
- **Responsive navigation shell.** In the browser shell, a left sidebar replaces the bottom bar at page widths of 720 px and above. Phones keep the bottom bar. Both hide during an active review session.
- **Screens.** Today, Practice, Add, Words and Settings are restyled to the boards. Words gains a separate Decks view, reached from a deck filter menu.
- **Correct-only progress.** The session progress bar and the "Card X of N" counter switch to one pure correct-only counter, `sessionProgress()`. "Correct" uses the same pass rule as the retry queue and the saved `is_correct`.
- **Gloss-only cards.** The card back and the meaning picker show the gloss only; the meaning picker drops its example line.
- **No backend changes.** No backend, API, schema or scheduling work. The only stored-data change is deleting the two local theme-preference keys.

## Technical Context

**Language/Version**: TypeScript ~6.0 / React 19.2 / React Native 0.85 / Expo SDK 56 (frontend only). The Go backend is untouched.

**Primary Dependencies**: `@react-navigation/bottom-tabs` ^7.18 (custom `tabBar`, `tabBarPosition`), `@react-navigation/native-stack` ^7.17, `expo-font` ^56, `react-native-web` ^0.21, `react-native-reanimated`, `react-native-safe-area-context`. To add: `@expo-google-fonts/geist`, `@expo-google-fonts/geist-mono`, `@expo-google-fonts/newsreader` and `@expo-google-fonts/ibm-plex-sans-kr`, all SIL OFL ([research R3](research.md#r3-fonts-loading-and-korean-fallback)). To remove: `@expo-google-fonts/inter`, once no references remain.

**Storage**: No server storage changes. The local keys `project_pn_theme_mode` and `project_pn_theme_variation` (localStorage on web, SecureStore on native) are deleted once at startup and never read again.

**Testing**: Jest 29 + `jest-expo` + `@testing-library/react-native` 14 (`npm test -w frontend`), `npm run typecheck -w frontend`, `npm run lint -w frontend`, and `npm run verify:full` from the root. The backend serial suite is unaffected but still runs in `verify:full`. Visual checks at 1440 px and 390 px use the `local-ui-verify` workflow ([quickstart.md](quickstart.md)).

**Target Platform**: Expo Web (desktop and mobile browsers), Tauri desktop (default 1000×720), iOS, Android.

**Project Type**: Multiplatform mobile/web client (`frontend/`) inside an npm-workspaces monorepo.

**Performance Goals**:
- Text is visible on the first web paint, using `font-display: swap` and fallback stacks (SC-009).
- No extra blocking network request on Today beyond one `GET /api/reviews/due?limit=5` for "Up next".
- English-only pages do not download the Korean font (browser fallback faces load lazily).

**Constraints**:
- Manual-first Add invariant (constitution IV). Keep the `tab-manual` and `manual-add-input-wrapper` testIDs and the `'manual'` default.
- The overlay width rule in `DESIGN.md`.
- Bilingual strings (`en` and `ko`).
- Touch targets of at least 44 px.
- WCAG 2.1 AA contrast.
- No API or DTO drift (FR-038).
- `review_attempts` payloads stay byte-for-byte unchanged (constitution II).

**Scale/Scope**:
- 5 primary screens, the navigation shell and about 12 shared UI primitives.
- 59 `useTheme()` consumers, kept working through a transitional alias layer.
- 14 files with hard-coded colors.
- About 4,100 lines across the five main screen files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Standard | Status | Evaluation |
| :--- | :--- | :--- |
| **I. Sense-Level Learning** | PASS | No changes to `words`, `word_senses` or `user_word_senses`. Personal meaning keeps precedence on cards (FR-017). |
| **II. Spaced Repetition & Attempt Immutability** | PASS | Scheduling, FSRS and `review_attempts` are untouched. `sessionProgress()` reads attempts and never mutates them. The `is_correct` and `rating_score` payload is unchanged ([contract](contracts/session-progress.md)). |
| **III. Lean MVP Schema & Architecture Isolation** | PASS | No schema, migration, endpoint or auth change. Decks already exist; this feature only moves their UI. |
| **IV. Cross-Platform Consistency & Product UI Invariants** | PASS | Add keeps `'manual'` as default and first. The visible label becomes "Word or phrase", but the testIDs stay and `AddScreen.test.tsx` keeps asserting Manual-first. Data fetching stays in `frontend/src/api/` (Today reuses `getDueLearningItems`). The shared `Input` is restyled, not forked. Existing undo patterns for local actions (passage clear) are kept. Word removal, which changes server data and can't be undone in the app, gets a confirmation guard (clarification #5). Every new string has `en` and `ko`. Layouts are responsive flexbox. |
| **V. Rigorous Testing & Serial Execution Discipline** | PASS | New pure-function and component tests. The full `verify:full` gate runs, including the serial backend suite. No tests are deleted or skipped (SC-006). |
| **Identity & Authentication** | PASS | Sign-in flow, tokens and logout behavior are unchanged; only their styling changes. |
| **Development Workflow & Quality Gates** | PASS | Routed docs (`DESIGN.md`, `frontend/docs/frontend-ux-patterns.md`) are read and updated in the same change (FR-037). The PR checklist for Add-cluster files applies. |

**Post-Design Re-Check** (after Phase 1): all gates still PASS.
- [data-model.md](data-model.md) introduces only client view models and removes local preference keys.
- [contracts/](contracts/) define UI and pure-function contracts with no network surface.
- The Add contract keeps the Manual-first testIDs.

## Project Structure

### Documentation (this feature)

```text
specs/005-design-refresh/
├── spec.md              # Feature specification (clarified)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R12
├── data-model.md        # Phase 1: client view models, state transitions
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── design-tokens.md     # Token names → values, type roles, alias map
│   ├── session-progress.md  # sessionProgress() contract + test vectors
│   └── navigation-shell.md  # Shell layout, routes, chrome hiding, shortcuts
├── checklists/
│   └── requirements.md  # Spec quality checklist
├── design/              # Reference boards (fonts stripped)
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
frontend/
├── app.json                         # already userInterfaceStyle: "light" (verify only)
├── App.tsx                          # StatusBar fixed to "dark" content; drop mode branching
├── package.json                     # + @expo-google-fonts/{geist,geist-mono,newsreader,ibm-plex-sans-kr}; − inter
├── src-tauri/tauri.conf.json        # window "theme": "Light"
└── src/
    ├── theme/
    │   ├── tokens.ts                # REWRITE: light-only semantic tokens, stage ramp, type roles, legacy alias map
    │   ├── fonts.ts                 # NEW: font registry, family names, web swap loading
    │   ├── ThemeProvider.tsx        # SIMPLIFY: no mode/variation; clears legacy keys; non-blocking web fonts
    │   └── *.test.ts(x)             # tokens contrast test, provider test
    ├── webkitStyleFix.web.ts        # + document color-scheme: light
    ├── api/storage.ts               # REMOVE theme storages; add one-shot legacy key cleanup
    ├── ui/                          # RESTYLE primitives: Button, Input, SegmentedControl, Chip(filter tab),
    │                                #   Switch, Card, Badge, RatingBar, RatingButton, AnimatedProgressBar, Text
    │   ├── Kbd.tsx                  # NEW: keyboard-hint chip (keyboard platforms only)
    │   ├── SelectableCard.tsx       # NEW: radio-style card (Add meanings)
    │   ├── ConfirmDialog.tsx        # NEW: cross-platform confirm modal (word removal guard)
    │   └── SettingsGroup.tsx        # NEW: grouped rows card + SettingsRow
    ├── hooks/
    │   └── useKeyboardShortcut.ts   # NEW: web/desktop shortcut hook (ignores focused inputs)
    ├── navigation/
    │   ├── MainTabs.tsx             # CustomTabBar → Sidebar | BottomBar by shell+width; chrome hiding
    │   ├── Sidebar.tsx              # NEW: desktop navigation (PN mark, 5 items, language pair)
    │   ├── shellKind.ts             # + SIDEBAR_MIN_PAGE_WIDTH = 720, CONTENT_MAX_WIDTH = 760
    │   ├── WordsStack.tsx           # + Decks route; WordsRoot { deckId? }
    │   ├── AddScreen.tsx            # restyle; label "Word or phrase"; keep testIDs/default
    │   └── *.test.tsx               # shell + Add invariant tests
    ├── ui/Screen.tsx                # TabBarScrollContext + chromeHidden/setChromeHidden
    ├── features/
    │   ├── learn/HomeScreen.tsx     # REWRITE as Today (header, glance strip, Up next, mastery)
    │   ├── learn/todaySummary.ts    # NEW: pure derivations (estimate, next review, totals)
    │   ├── practice/
    │   │   ├── practiceItemState.ts # + isPassingScore(), sessionProgress(); retire practiceCardProgress
    │   │   ├── PracticeScreen.tsx   # focus mode header; correct-only progress; restyled rating row
    │   │   └── Flashcard.tsx        # restyle; gloss-only back (verify)
    │   ├── add/ManualAddSection.tsx # big serif input, Find meanings, Add context disclosure
    │   ├── add/CaptureSection.tsx   # restyle only
    │   ├── words/MyWordsScreen.tsx  # table rows, search "/", stage tabs, deck filter menu; no inline DeckCanvas
    │   ├── words/DeckFilterMenu.tsx # NEW: All decks / each deck / New deck / Manage decks
    │   ├── words/DecksScreen.tsx    # NEW: hosts DeckCanvas/DeckList + DeckFormModal
    │   ├── profile/ProfileScreen.tsx# grouped Settings; goal presets; no theme row
    │   └── web/CommandDock.tsx      # remove theme toggle action
    ├── components/SensePicker.tsx   # gloss + POS/CEFR labels; drop example line
    └── i18n/translations.ts         # new/changed keys (en + ko)

DESIGN.md                            # document visual system, shell, light-only
frontend/docs/frontend-ux-patterns.md# Practice: correct-only progress; Add label; gloss-only picker note
```

**Structure Decision**: This is a frontend-only change inside the existing `frontend/` workspace. No new packages or workspaces are added. New code follows the existing layout: primitives in `src/ui`, navigation in `src/navigation`, screen features in `src/features/<area>`, and pure logic next to its feature (`practiceItemState.ts`, `todaySummary.ts`). `packages/api` and `backend/` are not modified.

## Delivery Order

The order follows the spec priorities. Each slice is shippable on its own, and `tasks.md` will expand them.

1. **Foundation** (blocks all stories): tokens and alias layer, fonts, light-only `ThemeProvider` with legacy key cleanup, restyled primitives, `Kbd`, and `useKeyboardShortcut`.
2. **US1 Today + shell** (P1): `Sidebar` and `BottomBar`, the 720 px switch, chrome hiding, and the Today rewrite.
3. **US2 Review session** (P1): focus header, `sessionProgress()` with its tests, the rating row, and the restyled flashcard.
4. **US3 Add** (P2): restyled Manual and Passage sections, `SelectableCard` meanings, and the gloss-only `SensePicker`.
5. **US4 Words + Decks** (P2): table rows, `DeckFilterMenu`, `DecksScreen`, and hover and touch actions.
6. **US5 Settings** (P3): grouped rows, goal presets with a custom value, and theme row removal.
7. **Polish**:
   - Restyle the unshown screens.
   - Migrate the remaining alias usages and delete the alias layer.
   - Remove `@expo-google-fonts/inter`.
   - Update the docs.
   - Run SC-008 and SC-011 searches, contrast tests, visual review and `verify:full`.

## Complexity Tracking

No constitution violations. The table is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

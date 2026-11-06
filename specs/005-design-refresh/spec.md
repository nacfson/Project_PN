# Feature Specification: Polished Design Refresh

**Feature Branch**: `005-design-refresh`

**Created**: 2026-11-05

**Status**: Ready for Planning

**Input**: User description: "I made a new polished design for project-pn. Could you make a spec with new design?" Source: `~/Downloads/Design.html` (seven boards: Today, Words, Practice answer side, Add, and Settings at 1440 px desktop; Today and Practice at 390 px phone). Unpacked reference screens live in [`design/`](./design/).

## Overview

The refresh replaces the current indigo, Material-style, "bento" look with a calm, editorial interface: a warm off-white canvas, near-black primary actions, one cobalt accent, a serif face for the words being learned, and a monospace face for pronunciation and keyboard hints. On wide screens, navigation moves from a bottom tab bar to a left sidebar. The review session becomes a distraction-free focus mode.

This is a **presentation-focused** change. It adds no learning data or API. Every existing capability (decks, phrases, passage capture, personal meanings, leech handling, repeat review, streak freezes, vacation mode) must remain reachable and must be restyled into the new visual language. Two intentional behavior changes are included: dark mode is removed (the app becomes light-only), and review-session progress counts only correctly answered cards.

## Clarifications

### Session 2026-11-05

- Q: The design's review card and meaning cards show an English definition and an example sentence, which conflicts with the gloss-only rule in `frontend-ux-patterns.md`. Which wins? → A: Keep gloss-only (option B). The card back shows only the chosen meaning. Meaning cards show the meaning with part of speech and level as small labels. The design's definition and example lines are dropped.
- Q: The design replaces the deck canvas and list on Words with an "All decks" filter. What happens to deck management? → A: Keep it as a separate deck view, opened from the deck filter (option B).
- Q: The design defines only a light palette. What happens to dark mode? → A: Remove dark mode entirely. The app supports only the light theme, and the dark "bento" variations and the theme setting are removed.
- Q: The session progress bar currently advances on every rating, including Forgot, and counts retries of the same failed card again, so it can reach 100% while failed cards remain. What should progress reflect? → A: Correct answers only. A card counts toward progress once it is answered correctly (Hard, Good, or Easy) in the session. Forgot never advances progress.
- Q: The design puts a one-click "delete" on every word row, and today removing a word happens immediately with no undo. How should removal be protected? → A: Ask for confirmation first ("Remove this word? This can't be undone."). The word is removed only after the learner confirms. This applies everywhere a word can be removed. Because removal changes server data and can't be reversed in the app, a confirmation guard is used instead of the undo toast that `frontend-ux-patterns.md` prefers for local-only actions such as clearing a passage.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Today screen and app shell (Priority: P1)

A learner opens Project PN and immediately sees what to do: today's date, how many words are due, roughly how long it will take, and one dominant "Start review" action. Beneath it is a quiet summary strip (daily goal progress, streak with freezes available, total words), a short "Up next" list, and a mastery bar across the six learning stages. On a wide screen, a left sidebar holds the product mark and the five destinations. On a phone, the same destinations sit in a bottom tab bar.

**Why this priority**: Today is the first screen every session, and the shell frames every other screen. Shipping it establishes the visual foundation (colors, type, spacing, controls) that all later stories reuse.

**Independent Test**: Sign in as a learner with due words. Compare the Today screen at 1440 px and 390 px against `design/01-today-desktop.html` and `design/06-today-phone.html`. Start a review using a single click, tap, or the Enter key.

**Acceptance Scenarios**:

1. **Given** a learner with 16 due words, **When** Today loads on a wide screen, **Then** it shows the date, the headline "16 words are due", an estimated duration, a primary "Start review" button with an Enter hint, and a secondary "Add a word" button.
2. **Given** the Today screen on web or desktop, **When** the learner presses Enter with no text field focused, **Then** the review session starts.
3. **Given** due words exist, **When** Today loads, **Then** "Up next" lists up to 5 due words, each showing lemma, pronunciation, and part of speech, followed by "and N more" when more remain, and a "See all words" link to Words.
4. **Given** the learner's items span several stages, **When** Today loads, **Then** the mastery bar shows each stage's share in its stage color, with a legend listing all six stages and their counts.
5. **Given** a viewport of 720 px or wider, **When** any non-session screen is shown, **Then** navigation appears as a left sidebar containing the "PN" mark, the five destinations (Today, Words, Add, Practice, Settings) with the current one highlighted, and the active language pair at the bottom.
6. **Given** a phone-width viewport, **When** any non-session screen is shown, **Then** navigation appears as a bottom tab bar with an icon and label for each of the same five destinations.

---

### User Story 2 - Focused review session (Priority: P1)

The learner starts a review and enters a focus mode: navigation disappears, and a slim header shows "End session", "3 of 16", and a thin progress line. One card is centered: part of speech, the word in large serif type, its pronunciation, and a play-audio control. Revealing the answer shows the chosen meaning and four rating choices (Forgot, Hard, Good, Easy). Each choice shows when the card will return. "Good" is visually emphasized as the usual answer.

**Why this priority**: Reviewing is the core learning loop. It is where learners spend most of their time.

**Independent Test**: Start a session with at least three due cards. Complete them using only the keyboard (Space to reveal, then 1–4 to rate), then using only touch on a phone. Compare against `design/03-practice-answer-desktop.html` and `design/07-practice-phone.html`, ignoring the definition and example lines, which are out of scope (see Clarifications). Fail at least one card and confirm the progress indicator does not move until that card is answered correctly.

**Acceptance Scenarios**:

1. **Given** a review session is active, **When** a card is shown, **Then** the app hides the main navigation and shows "End session", a "position of total" counter, and a progress indicator.
2. **Given** an unrevealed card on web or desktop, **When** the learner presses Space, **Then** the answer side is revealed.
3. **Given** a revealed card, **When** the answer side is shown, **Then** it shows only the chosen meaning (or the learner's personal meaning, with its "Your meaning" caption), with no English definition or example sentence.
4. **Given** a revealed card, **When** the learner presses 1, 2, 3, or 4, **Then** the card is rated Forgot, Hard, Good, or Easy respectively, and the next card appears.
5. **Given** a revealed card, **When** the rating choices appear, **Then** each shows its label, its keyboard number (on keyboard platforms), and the predicted next-review interval. "Good" uses the primary emphasis.
6. **Given** a phone, **When** a card is revealed, **Then** the four rating choices appear as an equal-width row pinned below the card, each at least 44 px tall, and the tab bar stays hidden.
7. **Given** a card whose meaning is long, **When** it is revealed, **Then** the content scrolls inside the card and never covers or pushes away the rating choices.
8. **Given** a card marked Retrying or Stuck (leech), **When** it is shown, **Then** its existing badge and the "Change meaning" secondary action remain available and are styled in the new visual language.
9. **Given** an active session, **When** the learner chooses "End session", **Then** the session ends using the existing end/sync behavior and returns to Today.
10. **Given** a session of 16 due cards with 3 answered correctly, **When** the learner rates the next card Forgot, **Then** the progress indicator stays at 3 of 16 (about 19%), and the card returns later in the session.
11. **Given** a card that was rated Forgot earlier in the session, **When** the learner later answers it correctly, **Then** progress advances by exactly one card, the same as for a card answered correctly on the first try.
12. **Given** a session with failed cards still waiting, **When** the progress indicator is shown, **Then** it is below 100%. It reaches 100% only when every due card in the session has been answered correctly.

---

### User Story 3 - Add a word (Priority: P2)

On Add, the learner sees "Add a word", which deck the word goes into (changeable inline), and a two-option switch: "Word or phrase" (selected by default) and "From a passage". They type a word into a large serif field and press "Find meanings" (or Enter). They can optionally expand "Add context" to give the source sentence, their own wording, or a part of speech. Matching meanings appear as selectable cards. The learner picks one and chooses "Add to deck", or chooses "None of these — search again".

**Why this priority**: Adding words is the second most frequent action and feeds every review. It also carries a product-locked invariant (Manual-first) that the redesign must preserve.

**Independent Test**: With a deck selected, open Add. The word input is visible immediately, with no extra tap. Look up "resilient", select a meaning, and add it. Confirm it appears in Words. Compare against `design/04-add-desktop.html`, ignoring the definition and example lines on the meaning cards (see Clarifications).

**Acceptance Scenarios**:

1. **Given** a deck is selected, **When** Add first renders, **Then** "Word or phrase" is the first and selected option and its input is visible without any extra interaction.
2. **Given** the learner typed a word, **When** they press Enter or "Find meanings", **Then** the lookup runs with the existing loading behavior, and results appear under "Which meaning did you mean?" with an "N found" count.
3. **Given** results are shown, **When** the learner looks at a meaning card, **Then** it shows a single simple meaning, with part of speech and level as small labels, and no English definition or example sentence.
4. **Given** results are shown, **When** the learner selects a meaning card, **Then** that card shows a selected state and "Add to deck" adds that meaning to the shown deck.
5. **Given** the learner expands "Add context", **When** they fill "Where you saw it", "Your own wording", or "Part of speech", **Then** these map to the existing source context, personal meaning, and part-of-speech filter respectively.
6. **Given** a source sentence was provided, **When** results appear, **Then** the existing "Closest to your sentence" indicator still marks the best-ranked meaning.
7. **Given** the learner chooses "From a passage", **When** the passage view opens, **Then** the existing passage capture flow works, restyled in the new visual language.

---

### User Story 4 - Words library (Priority: P2)

The learner opens Words and sees a calm, table-like list. Each row shows the word (serif) with its pronunciation, its meaning, its type, its stage (color swatch plus label), and when it is due. The learner can search ("/" focuses the search box), filter by stage using tabs that show counts, narrow to a deck, or create a deck. From the deck filter, the learner can also open a separate deck view to manage decks. Hovering a row on a pointer device reveals quick actions (play audio, move to another deck, delete). Opening a row shows the word's details.

**Why this priority**: Library management is important but less frequent than reviewing and adding.

**Independent Test**: With 16 words in one deck, open Words. Search for "late" and confirm "latency" remains. Filter by "New". Move a word to another deck from its row. Open the deck view from the deck filter, rename a deck, and return to the list. Compare against `design/02-words-desktop.html`.

**Acceptance Scenarios**:

1. **Given** the learner's words, **When** Words loads, **Then** the header shows "Words" with "N words in M decks", a deck filter ("All decks"), and a "New deck" action.
2. **Given** a keyboard platform, **When** the learner presses "/" while no text field is focused, **Then** the search field receives focus.
3. **Given** the stage filter tabs, **When** Words loads, **Then** tabs show All, New, Learning, Recognized, Recalled, Usable, and Mastered, each with its count. The active tab is filled near-black with white text.
4. **Given** a pointer device, **When** the learner hovers a row, **Then** quick actions for audio, move to deck, and delete appear. On touch devices, the same actions are reachable from the word's detail view.
5. **Given** a viewport narrower than 720 px, **When** Words renders, **Then** each row collapses to the word and stage only, hiding meaning, type, and due.
6. **Given** the learner chooses to remove a word (from a row action, from bulk selection, or from the word's detail view), **When** the action is triggered, **Then** a confirmation dialog asks "Remove this word? This can't be undone." with Cancel and Remove. The word is removed only after Remove is chosen. Cancel (or dismissing the dialog) leaves the word unchanged.
7. **Given** the deck filter is open, **When** the learner chooses the option to manage decks, **Then** a separate deck view opens showing every deck with its word counts, where the learner can open, rename, or delete a deck (the default deck cannot be deleted). Returning from the deck view brings the learner back to the Words list.
8. **Given** the deck view, **When** the learner opens a deck, **Then** Words shows the list filtered to that deck, and the deck filter shows that deck's name.

---

### User Story 5 - Settings (Priority: P3)

Settings appears as labeled groups of rounded cards: Account (email, connected accounts, language pairs), Review (daily goal choices, desired retention slider), Streak (vacation mode switch, use a streak freeze), Appearance (app language), and a final group (help and feedback, about with version, log out in the danger color). A note explains that changes save as you make them. There is no theme setting, because the app is light-only.

**Why this priority**: Settings change rarely, and every remaining setting already exists. This is a restyle plus the removal of the theme setting.

**Independent Test**: Change the daily goal, retention, vacation mode, and app language. Reload, and confirm each persisted with no explicit save step. Confirm no theme option is shown. Compare against `design/05-settings-desktop.html`, ignoring its Theme row (see Clarifications).

**Acceptance Scenarios**:

1. **Given** Settings, **When** it loads, **Then** groups appear in the order Account, Review, Streak, Appearance, then the help/about/log-out group, each as a rounded card with row dividers.
2. **Given** the daily goal row, **When** the learner selects 100, 200, 300, or 500, **Then** the goal is saved immediately and reflected on Today.
3. **Given** the desired retention slider (70–97%), **When** the learner moves it, **Then** the current percentage is shown beside it, and the value saves without an explicit save action.
4. **Given** the vacation mode switch, **When** it is toggled, **Then** the existing 7-day streak pause turns on or off.
5. **Given** a save fails, **When** the error occurs, **Then** the control reverts to its last saved value and an inline, translated error message is shown.
6. **Given** the Appearance group, **When** Settings loads, **Then** it contains only the app language row and no theme or dark-mode option.

---

### Edge Cases

- **Nothing due**: Today must still present one clear next step (for example, "Nothing due" with "Add a word" as the primary action) instead of a disabled "Start review". The board shows only the due state, so this state must be designed using the same visual language.
- **Brand-new learner (0 words)**: Today, Words, and the mastery bar need empty states. The mastery bar must not render as a misleading full bar.
- **Long or multi-word items**: Long phrases in the serif display face must wrap rather than overflow, in Up next, the Words list, the practice card, and the Add input.
- **Korean text**: Korean meanings must render in the Korean companion face, with no missing-glyph boxes, at every size used.
- **Fonts not yet loaded or unavailable**: Text must stay visible using system fallback faces (serif for display, monospace for pronunciation) while fonts load.
- **Narrow desktop windows (Tauri default 1000×720) and windows under 420 px**: The sidebar layout and the content column must remain usable at these sizes and follow the existing browser-frame scaling rules.
- **Touch devices**: Hover-only affordances (Words row actions, hover fills) must have touch-accessible equivalents. Keyboard hints should be hidden where no keyboard is expected.
- **Overlays**: Bottom sheets and dialogs (deck picker, move to deck, change meaning) must stay within the main UI width per `DESIGN.md`, including when the sidebar is present.
- **Lookups taking up to about 60 s**: The Add flow keeps its loading state for the full wait and does not show an error early.
- **Device set to dark mode**: The app still renders in the light theme on every platform. This includes native system chrome the app controls (status bar text, web `color-scheme`, browser form controls), which must use light-theme styling so nothing appears light-on-light or dark-on-dark.
- **Learner previously chose a dark theme**: On upgrade, any stored theme or dark-variation preference is ignored and the light theme is shown, with no error or prompt.

## Requirements *(mandatory)*

### Functional Requirements

**Visual foundation**

- **FR-001**: The app MUST adopt the design's light color system as its only color system, as listed in the Design Reference appendix: warm canvas, white surfaces, near-black text and primary actions, one cobalt accent, and the danger color.
- **FR-002**: The app MUST use a six-step stage color ramp (New → Mastered) consistently everywhere a learning stage is shown: the Today mastery bar and legend, Words stage swatches and filters, and word details.
- **FR-003**: The app MUST use three type roles: a sans-serif UI face with a Korean companion face, a serif display face for learnable words, and a monospace face for pronunciation and keyboard hints.
- **FR-004**: All colors, type styles, spacing, and corner radii MUST come from shared theme tokens. Restyled screens MUST NOT hard-code legacy palette values.
- **FR-005**: Shared controls MUST be restyled once and reused: primary button, secondary (outlined) button, quiet/text button, segmented switch, filter tabs, text field, switch, slider, selectable card, settings row, and keyboard-hint chip.
- **FR-006**: Numbers in statistics, counters, and progress MUST use tabular (fixed-width) figures.

**Navigation shell**

- **FR-007**: On viewports 720 px and wider (browser and desktop shells), primary navigation MUST be a left sidebar with the "PN" mark, five destinations in the order Today, Words, Add, Practice, Settings, a highlighted current destination, and the active language pair at the bottom.
- **FR-008**: On phone-width viewports, primary navigation MUST be a bottom tab bar with the same five destinations, each with an icon and label and a touch target of at least 44 px.
- **FR-009**: The "Learn" destination MUST be presented as "Today" in English and the equivalent in Korean.
- **FR-010**: Page content MUST sit in a centered reading column with a maximum width of 760 px on wide screens.

**Today**

- **FR-011**: Today MUST show the current date, a due-count headline, an estimated session duration, a primary "Start review" action, and a secondary "Add a word" action.
- **FR-012**: Today MUST show a summary strip with daily goal progress (XP earned of goal, with a progress bar), current streak with streak freezes available, and total words with the next review time after today.
- **FR-013**: Today MUST show an "Up next" list of up to 5 due items (lemma, pronunciation, part of speech), a remainder count, and a link to Words.
- **FR-014**: Today MUST show a mastery bar and a legend covering all six stages with counts.

**Review session**

- **FR-015**: A review session MUST hide primary navigation and show "End session", a position counter, and a progress indicator.
- **FR-015a**: Session progress MUST count only correctly answered cards. A due card is complete for the session when it receives a correct rating (Hard, Good, or Easy). A Forgot rating MUST NOT advance progress, and retries of the same card MUST NOT be counted more than once. Progress is the number of completed distinct due cards divided by the session's due-card total. It MUST never decrease during a session and MUST reach 100% only when every due card has been answered correctly.
- **FR-015b**: The position counter MUST use the same completed count as the progress indicator, showing the card being worked on as completed + 1 of the total (capped at the total), so that the counter and the bar always agree. In repeat review, the same rule applies: a card counts once, the first time it is answered correctly in the session.
- **FR-015c**: The rule for what counts as correct MUST be the same one used to decide whether a card is retried in the session and whether an attempt is recorded as correct. This keeps the progress indicator, the retry queue, and the saved review history consistent.
- **FR-016**: The question side MUST show part of speech, the lemma in the display face, pronunciation, and a play-audio control.
- **FR-017**: The answer side MUST show only the chosen meaning, as a single simple gloss, below a divider. It MUST NOT show an English definition or an example sentence as answer content. A non-empty personal meaning MUST still take precedence over the catalog gloss and keep its "Your meaning" caption. This keeps the existing gloss-only flashcard rule in `frontend-ux-patterns.md`.
- **FR-018**: Rating choices MUST be labeled Forgot, Hard, Good, and Easy, each showing its predicted next interval, with "Good" emphasized. Keyboard shortcuts MUST be Space to reveal and 1–4 to rate. Existing swipe-to-rate on touch MUST continue to work.
- **FR-019**: On phones, rating choices MUST be pinned below the card in a four-column row, the card's height MUST be capped so that long content scrolls inside it, and the tab bar MUST remain hidden while rating choices are visible.
- **FR-020**: Existing session features MUST remain available and restyled: Retrying and Stuck badges, "Change meaning", repeat review, the session-complete summary (including XP earned and stuck words), and sync failure and retry states.

**Add**

- **FR-021**: Add MUST keep the Manual-first invariant: "Word or phrase" (the manual option) is the first and default option, and its input is visible on first paint when a deck is selected. Renaming the visible label from "Manual Add" to "Word or phrase" MUST NOT weaken the `AddScreen.test.tsx` CI gate, which must still assert that the manual option comes first and is selected by default.
- **FR-022**: Add MUST show the target deck inline ("Adding to <deck>"), and the learner MUST be able to change the deck from that control.
- **FR-023**: Add MUST provide an optional, collapsed-by-default "Add context" section with "Where you saw it" (source context), "Your own wording" (personal meaning), and "Part of speech".
- **FR-024**: Meaning results MUST be presented as single-select cards. Each card shows one simple gloss (via the existing gloss simplification), with part of speech and level as small labels, and no English definition or example sentence. This keeps the existing single-gloss sense picker rule in `frontend-ux-patterns.md`. The results MUST include a found-count, "None of these — search again", and "Add to deck". The "Closest to your sentence" indicator MUST be kept.
- **FR-025**: "From a passage" MUST keep the existing passage capture behavior (including two-tap phrase selection), restyled.

**Words**

- **FR-026**: Words MUST show a header with total words and decks, a deck filter, a "New deck" action, a search field (focused by "/"), and stage filter tabs with counts.
- **FR-027**: Word rows MUST show word with pronunciation, meaning, type, stage, and due time, collapsing to word and stage below 720 px.
- **FR-028**: Row quick actions (audio, move to deck, delete) MUST appear on hover for pointer devices and MUST be reachable on touch devices through the word detail view.
- **FR-028a**: Every word-removal entry point (row action, bulk removal of selected words, word detail) MUST first show a confirmation dialog stating that the removal can't be undone, with Cancel and a danger-styled Remove action. No removal request is sent unless the learner confirms. For bulk removal, the dialog states how many words will be removed. The dialog MUST work on web, desktop, and phones, and its surface MUST stay within the main UI width per `DESIGN.md`.
- **FR-029**: Deck management MUST live in a separate deck view, opened from an option in the Words deck filter menu. The deck view MUST list every deck with its word counts and let the learner open a deck (returning to Words filtered to it), rename a deck, and delete a non-default deck, keeping the existing deck behaviors. The view MUST be restyled in the new visual language and MUST NOT appear inline on the Words list.

**Settings**

- **FR-030**: Settings MUST present grouped rows in the order Account, Review, Streak, Appearance, then help/about/log out, with log out in the danger color.
- **FR-031**: All settings MUST save on change, with no save button. A failed save MUST revert the control and show a translated inline error.
- **FR-032**: The daily goal MUST be chosen from preset values 100, 200, 300, and 500 XP. A learner whose saved goal is not a preset MUST see their value preserved and shown as selected until they change it.
- **FR-033**: The app MUST support only the light theme. Dark mode MUST be removed entirely: the dark palette, the dark "bento" visual variations, the theme setting, and any following of the device's dark-mode preference. Any previously stored theme preference MUST be ignored. The Appearance group in Settings MUST contain only app language.

**Cross-cutting**

- **FR-034**: Every new or changed user-facing string MUST have English and Korean translations.
- **FR-035**: All interactive controls MUST have accessible names and roles: progress bars, radio groups, tabs, and switches as in the design. Touch targets MUST be at least 44×44 px.
- **FR-036**: Keyboard-hint chips MUST appear only on platforms with a physical keyboard (web and desktop), not on phones.
- **FR-037**: The overlay width rule in `DESIGN.md` MUST continue to hold, and `DESIGN.md` MUST be updated to document the new visual system (tokens, type roles, shell layout, light-only theme). The Practice UX section of `frontend/docs/frontend-ux-patterns.md` MUST be updated to state that session progress counts distinct cards answered correctly.
- **FR-038**: The redesign MUST NOT change any API request, response, or stored server data. Removing the locally stored theme preference is the only change to stored data. The progress change (FR-015a–c) is display logic only: what is recorded for each review attempt and how cards are scheduled stay the same.

### Key Entities

This feature introduces no new persisted data. It changes only how existing entities are presented:

- **Learning item** (a learner's word or phrase sense): lemma, pronunciation, part of speech, gloss, personal meaning, stage, due time, deck, leech status.
- **Learning stage**: one of New, Learning, Recognized, Recalled, Usable, Mastered, each mapped to one ramp color.
- **Stats summary**: due count, XP today, daily goal, streak, freezes available, stage counts, next review time.
- **Review settings**: daily goal, desired retention, vacation mode, app language.
- **Rating choice**: Forgot, Hard, Good, or Easy, each with a predicted next interval.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a side-by-side review at 1440 px and 390 px, all seven reference boards are matched with no token-level deviations in color, type role, spacing scale, or radius. The only expected deviations are the ones decided in Clarifications: no definition or example lines on cards, no Theme row in Settings, and a deck-view entry in the deck filter. Any other deviation is listed and approved in the review notes.
- **SC-002**: A learner can start a review from Today with one action (one click, tap, or keypress).
- **SC-003**: On web and desktop, a learner can complete a card (reveal and rate) using two keystrokes and complete a 16-card session without using a pointer.
- **SC-004**: 100% of text and background color pairs in the new palette meet WCAG 2.1 AA contrast: 4.5:1 for body text, 3:1 for large text and UI component boundaries.
- **SC-005**: 100% of interactive controls on phone layouts measure at least 44×44 px.
- **SC-006**: The existing frontend test suite, typecheck, and `AddScreen.test.tsx` Manual-first gate pass with no tests skipped. Tests are deleted only when the code they cover is intentionally removed by this plan (for example the old progress counter), and each removal is replaced by tests covering the new behavior. Tests whose visible labels change are updated to assert the same behavior. The Manual-first assertions are never removed.
- **SC-007**: 0 user-facing strings are missing a Korean translation (verified by the translation key check).
- **SC-008**: 0 restyled screens reference legacy palette values directly. All color usage resolves through theme tokens (verified by search).
- **SC-009**: On web, while custom fonts load, text is never invisible: fallback text is visible from the first paint. On iOS and Android, the app keeps its current startup behavior and shows screens once fonts are ready.
- **SC-010**: Every capability reachable before the redesign, except dark mode, is still reachable afterward. This is verified against a capability inventory checklist covering decks (including the deck view), phrases, passage capture, personal meanings, change meaning, repeat review, streak freeze, vacation mode, language pairs, and log out.
- **SC-011**: With the device or browser set to dark mode, 100% of screens render in the light theme. A search of the frontend finds 0 remaining dark palette, dark-variation, or theme-toggle references.
- **SC-012**: In a 16-card session where 4 cards are failed once and then answered correctly, progress advances in exactly 16 steps of one card each, never moves on a Forgot rating, and reaches 100% only on the final correct answer. Automated tests cover the first-try correct, fail-then-correct, repeated-fail, and repeat-review cases.

## Assumptions

- **Scope is presentation-focused.** No backend, API, schema, or scheduling changes. All data shown in the design (due counts, XP, streaks, freezes, stage counts, due times, interval previews, CEFR level) is already provided by existing endpoints. The only behavior changes are removing dark mode (FR-033) and counting session progress on correct answers only (FR-015a–c).
- **"Correct" means Hard, Good, or Easy.** This matches the current session rule, where only Forgot sends a card back into the queue and is recorded as incorrect. Because a failed card keeps coming back until it is answered correctly, "100% progress" and "session complete" mean the same thing.
- **The session total is fixed when the session starts.** It is the number of due cards loaded. Retries add attempts, not cards, so the total does not change mid-session.
- **The session duration estimate** is derived on the client from the due count, at about 30 seconds per card. The design's 16 cards ≈ 8 minutes matches this. The context line ("All of them are new, so this is your first pass") adapts to the mix of new and review cards.
- **Practice tab behavior** stays as it is today. Choosing Practice starts or resumes a session when cards are due, and otherwise shows the restyled no-due state. The design only shows the in-session state.
- **Unshown screens** (sign-in, word detail, deck view and deck sheets, session complete, passage capture, language pairs, connected accounts, empty and error states) are restyled by applying the same tokens and controls, without new layouts. They are reviewed as part of SC-010.
- **Fonts** are open-licensed (SIL OFL): Geist, Geist Mono, Newsreader, and IBM Plex Sans KR. They are bundled with the app rather than fetched at runtime, loading only the weights the design uses (400, 500, 600).
- **The breakpoint** between sidebar and tab-bar layouts is 720 px, taken from the design's own narrow-layout rule. The phone shell continues to be detected by the existing shell logic.
- **The language pair label** in the sidebar reflects the learner's active pair and is display-only. Changing pairs happens in Settings.
- **Help and feedback** and **About** link to existing destinations, or are hidden if none exists yet.
- **Example sentences** stay in stored data and keep any existing non-card uses (for example, word details and repeat-review prompts). Only the card back and meaning picker drop them, per FR-017 and FR-024.
- **Light-only is a product decision**, not an accessibility regression. The light palette must meet the contrast criteria in SC-004 on its own.

## Design Reference

Values extracted from `Design.html`. Planning should turn these into theme tokens. Where the boards conflict with the Clarifications (definition and example lines, the Theme row), the Clarifications win.

### Color (light)

| Role | Value | Used for |
|---|---|---|
| Canvas | `#F6F6F3` | App background |
| Surface | `#FFFFFF` | Cards, inputs, settings groups, row hover |
| Text | `#17181B` | Primary text, primary button fill, active filter tab |
| Text secondary | `#4A4C53` | Secondary copy, quiet buttons |
| Text muted | `#5E6068` | Captions, metadata, inactive nav |
| Hairline | `#E4E4DF` | Section rules, card borders, progress track |
| Divider (inner) | `#EEEEEA` | Rows inside settings groups |
| Control border | `#D9D9D3` | Inputs, outlined buttons, switch off |
| Control border hover | `#B9BAB4` | Selectable card hover |
| Hover / selected fill | `#ECECE8` | Nav hover and active, segmented track |
| Segmented track (alt) | `#F0F0EC` | Settings segmented controls |
| Primary hover | `#2E3036` | Primary button hover |
| Accent | `#2846C4` | Links, progress fills, focus ring |
| Accent hover | `#1C3399` | Link hover |
| Danger | `#B42318` | Log out, destructive text |

### Stage ramp

| New | Learning | Recognized | Recalled | Usable | Mastered |
|---|---|---|---|---|---|
| `#C4C6CC` | `#A9B6EA` | `#7C90DE` | `#5069CF` | `#2846C4` | `#172C85` |

### Type

| Role | Face | Sizes / weight |
|---|---|---|
| UI | Geist (Korean: IBM Plex Sans KR) | 11–16 px body; section titles 15/600; page titles 32/600 at −0.02em; Today headline 40/600 (phone 32) |
| Display | Newsreader | Mark 22/500; list lemmas 20–22/400; Add input 22; card lemma 56 (phone 44)/400 |
| Mono | Geist Mono | Pronunciation 12–14; key hints 11 |

### Shape and layout

- **Radii**: 5 (key hints), 7–8 (nav, tabs, segments), 10 (inputs, buttons), 12 (large buttons, selectable cards, rating choices), 14 (settings groups), 16 (review card).
- **Control heights**: 32 (tabs, segments), 36 (nav items), 40–44 (buttons, inputs), 48–52 (hero actions, Add input).
- **Desktop**: sidebar flex-basis 232 px with a hairline right border. The content column is at most 760 px wide, with padding of 56 px top, 32 px sides, and 80 px bottom.
- **Phone**: 20 px side padding. The tab bar has a hairline top border and 52 px minimum items.
- **Elevation**: almost none. Separation comes from hairlines and surface contrast. The only shadow is a subtle one on the selected segment.

### Reference screens

| Board | File |
|---|---|
| Today, desktop | [`design/01-today-desktop.html`](./design/01-today-desktop.html) |
| Words, desktop | [`design/02-words-desktop.html`](./design/02-words-desktop.html) |
| Practice (answer side), desktop | [`design/03-practice-answer-desktop.html`](./design/03-practice-answer-desktop.html) |
| Add, desktop | [`design/04-add-desktop.html`](./design/04-add-desktop.html) |
| Settings, desktop | [`design/05-settings-desktop.html`](./design/05-settings-desktop.html) |
| Today, phone | [`design/06-today-phone.html`](./design/06-today-phone.html) |
| Practice, phone | [`design/07-practice-phone.html`](./design/07-practice-phone.html) |

These files are the design's page markup with embedded fonts removed, kept as a readable reference. They do not render standalone, because the original preview runtime is not included. The full self-rendering bundle is the original `Design.html`.

# Unified Add Tab Design

## Context

The Add tab currently uses a segmented control with three modes: Capture, Manual Add, and Import. Each mode is isolated, switching modes feels jarring, and the Manual Add flow opens a bottom-sheet modal that the user found disconnected. This design merges the daily-use input methods into a single scrollable page and removes Import from the Add tab.

## Goal

- Replace the segmented three-mode Add tab with one continuous scrollable screen.
- Remove the bottom-sheet AddWordModal from the Add tab flow.
- Remove the Import section from the Add tab (Import code remains in the repo but is no longer reachable from this tab).
- Share a single target-deck selector across all add methods on the screen.
- Keep passage capture as the primary method, with inline manual add as a compact fallback.

## Non-Goals

- Do not delete the Anki import feature code; only remove its entry point from the Add tab.
- Do not redesign the Practice, Words, Learn, or Settings tabs.
- Do not change the backend add-word API.

## Design

### Layout

`AddScreen` becomes a single `ScrollView` with these stacked areas:

1. **Sticky top bar** — screen title and a searchable target-deck dropdown.
2. **Capture card** — passage textarea, tappable word preview, selected-word chips, and "Add selected" button.
3. **Manual add card** — inline word input, optional POS selector, Add button, and recently-added word chips.

Visual style follows iOS grouped-cards: rounded corners, subtle background tints, full-width primary buttons, and hairline separators. No bottom sheets or modals are used for adding words.

### Deck Selector

- Fetches decks via `listDecks(activeTargetLanguage)` on mount.
- Defaults to the deck where `is_default === true`.
- Remembers the user's selection for the rest of the Add tab session.
- Disabled while any add job is pending or processing so words do not split across decks.
- Rendered as a searchable dropdown: closed state shows selected deck + chevron; opened state shows a search field + scrollable deck list.

### Data Flow

- `AddScreen` owns `selectedDeckId` and passes it to both the Capture and Manual Add sections.
- Both sections enqueue words through the same async queue (`useAddQueue`) so they share consistent pending/added/error chip feedback.
- `useAddQueue` is updated to accept a target deck id; each job stores its deck id and passes it to `addLearningItem(..., deckId)`.
- The deck selector is disabled while any job is pending or processing, so in practice the deck cannot change mid-batch. As a safety rule, if the deck does change, only newly enqueued jobs use the new deck.
- Language codes come from `useActiveTargetLanguage` (target language) and the user's display/definition language setting.

### Components

- `AddScreen` — orchestrates shared deck state, scroll layout, and section order.
- `CaptureSection` — extracted from the current `CaptureScreen`; receives `selectedDeckId` and uses the deck-aware queue. The old `CaptureScreen` is refactored into this section.
- `ManualAddSection` — new inline manual-add component; receives `selectedDeckId` and uses the same queue. Replaces the `AddWordModal` invocation inside `AddScreen`.
- `TargetDeckSelector` — new searchable deck dropdown component.

`AddWordModal` itself is not deleted; it may still be used from the Home screen. Only its use inside `AddScreen` is removed.

### Error Handling & Feedback

- Deck load failure shows an inline retry banner; capture and manual add remain usable if a default deck is known.
- "Add selected" is disabled when no words are selected.
- Manual "Add" is disabled when the input is empty.
- Each word chip shows status: pending spinner, added check, or error cross.
- Errors on a chip include an inline caption or tooltip with the reason (e.g., word not found, network error).
- Passage clear keeps the existing undo pattern.
- No blocking alert dialogs.

### Translations

Add new translation keys for both `en` and `ko`:

- `add.title` — "Add Words" / "단어 추가"
- `add.targetDeck` — "Target Deck" / "대상 덱"
- `add.searchDecks` — "Search decks" / "덱 검색"
- `add.fromPassage` — "From a passage" / "문장에서 추가"
- `add.addOneWord` — "Add one word" / "단어 하나 추가"
- `add.deckLoadFailed` / `add.deckLoadRetry` — deck load error messages

## Testing

- **AddScreen** (RNTL):
  - Loads decks and defaults to the default deck on mount.
  - Remembers the selected deck during the session.
  - Disables the deck selector while jobs are pending.
  - Does not render Import content.
- **CaptureSection**:
  - Enqueues selected words with the current `selectedDeckId`.
  - Disables "Add selected" when no words are selected.
- **ManualAddSection**:
  - Disables Add button when input is empty.
  - Enqueues the typed word with the current `selectedDeckId`.
  - Shows added/pending/error chips.
- **useAddQueue**:
  - Jobs include `deckId` and `addLearningItem` is called with it.
  - Deck changes affect only new jobs.

## Open Questions / Future Work

- Whether to persist the last-selected Add tab deck across app restarts (out of scope; session-only for now).
- Whether to add keyboard shortcuts or larger desktop targets for the Tauri build (can be addressed during implementation if needed).

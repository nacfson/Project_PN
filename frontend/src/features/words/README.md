# Words Feature

## Overview
Implements the Words library, deck management, word detail inspection, meaning/sense switching, and bulk item organization (move/archive) backed by cursor-paginated learning-item fetching and optimistic deck count helpers.

## Interface
- `MyWordsScreen({ route? })` `[MyWordsScreen.tsx:MyWordsScreen]` and `MyWordsScreenProps` `[MyWordsScreen.tsx:MyWordsScreenProps]` — Primary Words tab screen with search (`/` web shortcut), stage filter chips, deck filter menu, responsive wide table vs. mobile rows, multi-select contextual command bar (move/archive), and pull-to-refresh/infinite pagination.
- `WordDetailScreen({ route, navigation })` `[WordDetailScreen.tsx:WordDetailScreen]` — Detail screen (`WordsStackParamList['WordDetail']`) showing lemma, IPA, TTS pronunciation, POS/stage/leech/CEFR badges, gloss attribution, added/due dates, and Change Meaning, Move to Deck, and Remove actions.
- `DecksScreen({ navigation })` `[DecksScreen.tsx:DecksScreen]` — Deck management screen (`WordsStackParamList['Decks']`) for listing, creating, renaming, deleting non-default decks, and navigating back to `WordsRoot` filtered by a chosen deck.
- `ChangeMeaningSheet({ visible, item, onClose, onChanged, onBusyChange?, preferPersonalNote? })` `[ChangeMeaningSheet.tsx:ChangeMeaningSheet]` — Bottom-sheet modal for switching a learning item's `word_sense_id`, forcing context-based additional sense lookup, and saving or clearing a `personal_note`.
- `DeckFilterMenu({ decks, selectedDeckId, deckCounts?, totalWordsCount?, onSelectDeck, onNewDeck, onManageDecks, defaultOpen? })` `[DeckFilterMenu.tsx:DeckFilterMenu]` and `DeckFilterMenuProps` `[DeckFilterMenu.tsx:DeckFilterMenuProps]` — Responsive deck filter rendering a dropdown on wide/desktop layouts and a bottom-sheet modal on phone layouts.
- `DeckFormModal({ visible, mode, deck?, onClose, onSubmit, onDelete?, isLoading?, error? })` `[DeckFormModal.tsx:DeckFormModal]` and `DeckFormModalProps` `[DeckFormModal.tsx:DeckFormModalProps]` — Bottom-sheet form modal for creating or renaming a deck, with inline two-step delete confirmation for non-default decks.
- `MoveToDeckModal({ visible, decks, excludeDeckId?, onClose, onSelect, isLoading?, error? })` `[MoveToDeckModal.tsx:MoveToDeckModal]` and `MoveToDeckModalProps` `[MoveToDeckModal.tsx:MoveToDeckModalProps]` — Bottom-sheet modal listing destination decks excluding `excludeDeckId`.
- `DeckCanvas({ decks, selectedId, onSelect, onCreate, onEdit?, onInspect? })` `[DeckCanvas.tsx:DeckCanvas]` and `DeckCanvasProps` `[DeckCanvas.tsx:DeckCanvasProps]` — Two-column deck card grid with hover-revealed inspect/rename actions and a dashed New Deck card.
- `DeckList({ decks, selectedId, onSelect, onCreate, onEdit })` `[DeckList.tsx:DeckList]` and `DeckListProps` `[DeckList.tsx:DeckListProps]` — Horizontal scrollable chip bar showing "All decks", per-deck chips with item counts and edit triggers, and a "Create deck" chip.
- `useLearningItems(q, deckId?, enabled?, languageCode?)` `[useLearningItems.ts:useLearningItems]` — Hook managing debounced (`300` ms) cursor-paginated learning-item loading (`PAGE_SIZE = 50`), refresh, scroll-triggered pagination, optimistic local item removal, and stale-request cancellation.
- `adjustDeckCountsForRemovedItems(decks, removedItems)` `[deckCounts.ts:adjustDeckCountsForRemovedItems]` and `adjustDeckCountsForMove(decks, movedItems, targetDeckId)` `[deckCounts.ts:adjustDeckCountsForMove]` — Pure helpers updating deck `item_count` values optimistically after archive or move operations.
- `distanceFromListBottom(contentHeight, viewportHeight, offsetY)` `[scrollPagination.ts:distanceFromListBottom]`, `readScrollMetrics(nativeEvent, fallbacks?)` `[scrollPagination.ts:readScrollMetrics]`, and `ScrollMetrics` `[scrollPagination.ts:ScrollMetrics]` — Pure scroll-geometry helpers for pagination triggers.

## Invariants
- `useLearningItems` uses a monotonically incrementing `requestIdRef` to discard out-of-order responses, guards concurrent `loadMore` calls with `loadingMoreRef`, and resets `items`/`nextCursor` to empty/`ready` when `enabled === false` `[useLearningItems.ts:useLearningItems]`.
- On web (`Platform.OS === 'web'`), `useLearningItems` eagerly fetches remaining pages while `hasMore` is true because RN Web `FlatList` end-reached events are unreliable, and `MyWordsScreen` renders a `Screen` scroll container instead of `Animated.FlatList` `[useLearningItems.ts:useLearningItems]`, `[MyWordsScreen.tsx:MyWordsScreen]`.
- `DecksScreen` and `DeckFormModal` forbid deleting default decks (`!deck.is_default`); `DeckFormModal` validates non-empty trimmed names of at most `120` characters and closes without submitting if a rename is unchanged `[DecksScreen.tsx:DecksScreen]`, `[DeckFormModal.tsx:DeckFormModal]`.
- `MoveToDeckModal` always excludes `deck.id === excludeDeckId` from selectable destination decks `[MoveToDeckModal.tsx:MoveToDeckModal]`.
- `ChangeMeaningSheet` closes without issuing a mutation when both `selectedId === item.word_sense_id` and trimmed `personalDraft` matches `item.personal_note`, requires non-empty trimmed context for `handleFindMore`, and surfaces HTTP `409` as `words.senseConflict` `[ChangeMeaningSheet.tsx:ChangeMeaningSheet]`.
- `adjustDeckCountsForRemovedItems` and `adjustDeckCountsForMove` clamp decremented `item_count` values to `>= 0` and ignore moves where `item.deck_id === targetDeckId` `[deckCounts.ts:adjustDeckCountsForRemovedItems]`, `[deckCounts.ts:adjustDeckCountsForMove]`.
- `distanceFromListBottom` and `readScrollMetrics` return `null` whenever `contentHeight <= 0` or `viewportHeight <= 0` `[scrollPagination.ts:distanceFromListBottom]`, `[scrollPagination.ts:readScrollMetrics]`.

## Side Effects
- Performs backend API requests: `listLearningItems`, `archiveLearningItem`, `archiveLearningItems`, `listDecks`, `createDeck`, `renameDeck`, `deleteDeck`, `moveItemsToDeck`, `lookupWord`, `changeLearningItemSense`, and `setLearningItemPersonalNote` `[useLearningItems.ts:useLearningItems]`, `[MyWordsScreen.tsx:MyWordsScreen]`, `[DecksScreen.tsx:DecksScreen]`, `[WordDetailScreen.tsx:WordDetailScreen]`, `[ChangeMeaningSheet.tsx:ChangeMeaningSheet]`.
- Optimistically mutates local items and deck counts before move/archive API calls and reconciles by reloading on completion or failure `[MyWordsScreen.tsx:MyWordsScreen]`.
- Refreshes active language, decks, and learning items on screen focus (`useFocusEffect`), registers a web `/` keyboard shortcut to focus search, and navigates to `WordDetail`, `Decks`, `WordsRoot`, and `Settings -> LanguagePairs` `[MyWordsScreen.tsx:MyWordsScreen]`, `[DecksScreen.tsx:DecksScreen]`, `[WordDetailScreen.tsx:WordDetailScreen]`.
- Reads `navigator.userAgent`, `window.innerHeight`, `Platform.OS`, and window dimensions for responsive table/sheet layout and scroll metrics `[MyWordsScreen.tsx:MyWordsScreen]`, `[DeckFilterMenu.tsx:DeckFilterMenu]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`

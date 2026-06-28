# Premium Web UX Upgrade

**Date:** 2026-06-27
**Scope:** Frontend UI/UX upgrade for Project PN, web-first
**Status:** Design approved

## Goal

Make the web version of Project PN feel premium, instantly responsive, and alive by keeping the existing Material Design 3 purple color system and doubling down on **interaction quality, motion, and web-native power patterns**.

The upgrade is **web-first**; iOS/Android keep working as-is and only benefit from shared components where the changes are free (e.g., updated `Card`, `Button`, `Screen`).

## Decisions Summary

| Topic | Decision |
|-------|----------|
| Color system | Keep current MD3 tokens in `theme/tokens.ts` |
| Platforms | Web gets full treatment; mobile gets passive improvements only |
| Primary interaction model | Hover-reveal cards + command dock + right inspector panel |
| Navigation on web | Push screens stay for full-page flows; inspector panels replace detail pushes for quick edits |
| Motion | Consistent spring/ease timing; respect `prefers-reduced-motion` |
| Lists | Staggered entrance, shimmer skeletons, empty-state animations |
| Words tab | Deck canvas grid with hover preview and selection |
| Global actions | Floating command dock (web only) |
| Detail/edit actions | Right slide-over inspector panel (web only) |
| Batch actions | Multi-select decks/words with contextual command bar; v1 uses sequential API calls |
| Backend changes | None required for the UI-only layers; batch endpoints may be added later for large selections |

## Scope

### In Scope

- Global motion system and hover states for shared UI primitives (`Card`, `Button`, `Screen`, `Input`, lists).
- Floating command dock visible on web.
- Right inspector panel for deck and word details on web.
- Deck canvas grid on the Words tab.
- Contextual command bar for batch selection.
- Staggered list entrances and shimmer loading states.
- Web-only hover/reveal actions on cards.

### Out of Scope

- New color palette or re-branding.
- Native iOS/Android gesture redesign.
- Backend batch endpoints (optional future optimization).
- Offline-mode changes.
- New learning modes or algorithms.

## UX Patterns

### 1. Cinematic Cards

Every card in the app lifts on hover and reveals secondary actions.

- **Rest state:** flat surface, subtle border.
- **Hover state (web):** `scale: 1.01`, shadow upgrades from `sm` → `md` or `md` → `lg`, and secondary action chips fade in.
- **Press state:** `scale: 0.98` on press (already partially implemented).
- **Entry:** list cards stagger in with a 40 ms delay and a short `translateY(8px) → 0` + opacity fade.
- **Implementation:** a new `CinematicCard` wrapper around the existing `Card`, plus a `HoverReveal` container for action chips.

### 2. Command Dock

A compact vertical dock pinned to the bottom-right on web (floating, not inside the tab bar).

- Items: Quick add word, Start review, Search everywhere, Toggle theme.
- Collapses to a single "fab" menu on narrow web widths.
- Tooltips on hover show the label and keyboard shortcut.
- Hidden on mobile native; the existing bottom tab bar remains.

### 3. Inspector Panel

A right-side slide-over panel used for quick details and edits instead of pushing a full screen.

- Triggered by selecting a deck card in Words or a word row.
- Swipes/drags closed on web via a drag handle.
- On mobile, the existing detail screens remain; the inspector is web-only.
- Content adapts by entity: deck stats + rename/delete/move; word definition + stage + due date + delete/move.

### 4. Deck Canvas

The Words tab landing becomes a responsive grid of deck tiles.

- Each tile shows deck name, word count, and a tiny progress ring.
- Hover previews the 3 most recently added words.
- Clicking a deck tile loads its word list inline.
- An "Info" action chip on each tile opens the inspector for quick edits.
- A persistent "New deck" tile at the end of the grid.

### 5. Contextual Command Bar

When one or more decks or words are selected, a floating bar appears near the selection (or at the top of the list on web) with batch actions.

- Deck actions: Rename, Delete, Set default (merge is future scope).
- Word selection opens the inspector for per-item actions; batch word actions are future scope.
- Clear selection button always visible.

### 6. Motion System

- **Easing:** spring for interaction, ease-out for entrances.
- **Durations:** 150 ms micro-interactions, 250 ms card transitions, 350 ms panel slides.
- **Stagger:** 40 ms base delay, max 600 ms total.
- **Reduced motion:** if `prefers-reduced-motion` is true, disable scale/translate and keep only opacity changes.

## Per-Screen Changes

### Home

- Hero review card becomes a large cinematic card with hover-lift and a revealed "Start review" arrow.
- Stats grid cards stagger in on focus.
- Word of the Day and capture re-entry cards get hover action chips ("Add", "Skip").
- Forecast bars animate height on entry.

### Words

- Replace the current top deck list with a deck canvas grid.
- Selecting a deck opens the word list inline below the grid.
- The inspector opens from the deck tile's info chip for quick edits.
- Word list rows become cinematic cards with hover-reveal actions: "Speak", "Edit", "Move".
- Multi-select checkboxes appear on hover/focus; selecting shows the contextual command bar.
- Search and filter chips stay, but filter chips animate selection state.

### Add

- The unified Add screen stays structurally the same.
- Cards lift on hover; the target deck selector opens with a snappy animation.
- Job chips in `ManualAddSection` animate in/out as queue jobs complete.
- Passage capture textarea gets a subtle focus glow.

### Practice

- Flashcard uses 3D flip animation on reveal.
- Progress bar animates width changes smoothly.
- Rating buttons scale on hover and stagger in when the answer is revealed.
- Session complete screen uses confetti-like badge pop (no external library; simple scaled dots).

### Settings

- Setting rows become cinematic cards with hover chevron reveal.
- Language pair list staggers in.
- Theme toggle animates the switch thumb.

## Component Architecture

### New Shared Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `CinematicCard` | `frontend/src/ui/CinematicCard.tsx` | Hover-lift card wrapper with configurable reveal actions |
| `HoverReveal` | `frontend/src/ui/HoverReveal.tsx` | Fades in children on hover; no-op on touch |
| `CommandDock` | `frontend/src/features/web/CommandDock.tsx` | Floating global action dock (web only) |
| `InspectorPanel` | `frontend/src/features/web/InspectorPanel.tsx` | Right slide-over panel (web only) |
| `DeckCanvas` | `frontend/src/features/words/DeckCanvas.tsx` | Grid of deck tiles with hover preview |
| `ContextualCommandBar` | `frontend/src/ui/ContextualCommandBar.tsx` | Batch action bar for selected items |
| `StaggeredList` | `frontend/src/ui/StaggeredList.tsx` | Wrapper that animates children in with stagger |
| `SkeletonCard` | `frontend/src/ui/SkeletonCard.tsx` | Shimmer placeholder card |
| `AnimatedProgressBar` | `frontend/src/ui/AnimatedProgressBar.tsx` | Smooth width transitions |

### New Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useHover` | `frontend/src/hooks/useHover.ts` | Cross-platform hover state using `onHoverIn`/`onHoverOut` |
| `useReducedMotion` | `frontend/src/hooks/useReducedMotion.ts` | Reads `prefers-reduced-motion` |
| `useSelection` | `frontend/src/hooks/useSelection.ts` | Multi-select state helpers |

### Updated Primitives

- `Card`: add optional `hoverElevation` and `hoverScale` props; default stays current to avoid breaking existing tests.
- `Button`: add subtle hover background shift on web.
- `Screen`: keep current behavior; no breaking changes.

## Data Flow

The upgrade is mostly presentational. No new backend endpoints are required for the base experience.

- Inspector panels receive the selected entity via props; for decks this is the existing `Deck` object, for words the existing `LearningItemListItem`.
- Batch actions in v1 call existing per-item endpoints (`deleteDeck`, `renameDeck`) in parallel for decks. Word-level batch actions (move, delete) are out of scope until a backend batch endpoint exists; the command bar can offer per-item actions via the inspector.
- Command dock actions route through existing navigation and hooks (`useAddQueue`, `useNavigation`).

## Error Handling

- Motion failures are silent; if a spring animation throws, the component falls back to its rest state.
- Inspector load errors show an inline `ErrorState` inside the panel without closing it.
- Batch action failures show per-item inline error chips and a "Retry failed" option in the command bar.
- All async transitions use loading spinners in the command bar or dock item, never blocking the whole UI.

## Accessibility

- Hover-only actions are also reachable via focus and screen-reader activation.
- `prefers-reduced-motion` disables scale/translate; opacity-only or instant state changes remain.
- Inspector panel traps focus while open and restores focus on close.
- Command dock items have visible labels on focus and `aria-label`s.
- Batch selection checkboxes are labeled with the entity name.

## Testing

### Unit Tests

- `useHover` returns hover state correctly.
- `useReducedMotion` returns `true` when media query matches.
- `CinematicCard` applies hover styles on `onHoverIn`.
- `InspectorPanel` renders children and calls `onClose`.
- `StaggeredList` renders children and applies animation styles.

### Screen Tests

- Words screen renders `DeckCanvas` when data loads.
- Selecting a deck opens the word list or inspector.
- Batch selection toggles command bar visibility.
- Command dock actions navigate to the expected screens.

### Visual/Integration

- Run the local web process and verify hover states, dock, and inspector on desktop browser.
- Verify reduced-motion fallback in browser dev tools.

## Implementation Order

1. Motion system: `useReducedMotion`, `useHover`, update `Card`/`Button`.
2. Staggered lists and skeletons on Home.
3. `InspectorPanel` and `CommandDock` shells (web only).
4. Words tab deck canvas + inspector wiring.
5. Contextual command bar for batch actions.
6. Polish: Practice flip animation, settings hover rows.

## Open Questions

None. Design decisions are approved.

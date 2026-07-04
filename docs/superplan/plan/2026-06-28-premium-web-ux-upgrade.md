# Premium Web UX Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement premium motion systems, a bottom-right floating command dock, right slide-over inspector panels, a deck canvas grid layout, and a contextual batch action bar on the frontend web version.

**Architecture:** Extend UI components and hooks to dynamically detect hover, screen width, and reduced-motion preferences, rendering specialized web layouts and controls on Desktop browsers while keeping mobile native as-is.

**Architecture Diagram:**
```mermaid
graph TD
    subgraph "Shared UI Components"
        Card[Card / CinematicCard]
        Button[Button]
        StaggeredList[StaggeredList]
        SkeletonCard[SkeletonCard]
    end
    subgraph "Web Feature Components"
        CommandDock[CommandDock]
        InspectorPanel[InspectorPanel]
        ContextualCommandBar[ContextualCommandBar]
    end
    subgraph "Screen Integration"
        MyWordsScreen[MyWordsScreen] --> DeckCanvas[DeckCanvas]
        MyWordsScreen --> InspectorPanel
        MyWordsScreen --> ContextualCommandBar
        HomeScreen[HomeScreen] --> CommandDock
        HomeScreen --> StaggeredList
        RootNavigator[RootNavigator] --> CommandDock
    end
```

**Tech Stack:** React Native / Expo Web / TypeScript, React Native Animated

## Global Constraints

- Keep current MD3 tokens in `theme/tokens.ts`
- Push screens stay for full-page flows; inspector panels replace detail pushes on web for quick edits
- Responsive flexbox; support mobile, web, and Tauri
- Hover actions on web must be reachable via focus and screen readers
- `prefers-reduced-motion` disables scale/translate transitions

---

### Task 1: Motion System & Hover Utilities

**Files:**
- Create: [useHover.ts](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/hooks/useHover.ts)
- Test: [useHover.test.ts](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/hooks/useHover.test.ts)
- Create: [useReducedMotion.ts](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/hooks/useReducedMotion.ts)
- Test: [useReducedMotion.test.ts](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/hooks/useReducedMotion.test.ts)
- Modify: [Card.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/ui/Card.tsx)
- Modify: [Button.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/ui/Button.tsx)

**Interfaces:**
- `useHover()`: returns `{ isHovered: boolean, hoverProps: { onHoverIn: () => void, onHoverOut: () => void } }`
- `useReducedMotion()`: returns `boolean`
- `CardProps`: add optional `hoverScale?: boolean` and `hoverElevation?: boolean`

- [ ] **Step 1: Write the failing tests for hooks**
  Create `frontend/src/hooks/useHover.test.ts` and `frontend/src/hooks/useReducedMotion.test.ts` to assert hover transitions and media query bindings.
- [ ] **Step 2: Run tests to verify they fail**
  Run: `npm test -- src/hooks/useHover.test.ts src/hooks/useReducedMotion.test.ts --watchAll=false`
  Expected: FAIL (hooks do not exist).
- [ ] **Step 3: Implement useHover and useReducedMotion hooks**
  Create `frontend/src/hooks/useHover.ts` and `frontend/src/hooks/useReducedMotion.ts`.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm test -- src/hooks/useHover.test.ts src/hooks/useReducedMotion.test.ts --watchAll=false`
  Expected: PASS.
- [ ] **Step 5: Modify Card and Button components to support hover & motion**
  Update `frontend/src/ui/Card.tsx` using `useHover` and `useReducedMotion` to scale by `1.01` and elevate shadow on hover when enabled. Update `frontend/src/ui/Button.tsx` to shift background color slightly on pointer hover on web.
- [ ] **Step 6: Run existing UI tests to verify no regressions**
  Run: `npm test -- src/ui/Card.test.tsx src/ui/Button.test.tsx --watchAll=false` (if exist, or run full suite)
  Expected: PASS.
- [ ] **Step 7: Commit**
  Run: `git commit -am "feat(ui): implement hover hooks and hover-aware Card and Button components"`

---

### Task 2: Staggered Lists and Skeleton Placeholders

**Files:**
- Create: [StaggeredList.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/ui/StaggeredList.tsx)
- Create: [SkeletonCard.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/ui/SkeletonCard.tsx)
- Create: [StaggeredList.test.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/ui/StaggeredList.test.tsx)
- Create: [SkeletonCard.test.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/ui/SkeletonCard.test.tsx)
- Modify: [HomeScreen.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/features/learn/HomeScreen.tsx)

**Interfaces:**
- `StaggeredListProps`: `{ children: React.ReactNode[], delay?: number }`
- `SkeletonCardProps`: `{}`

- [ ] **Step 1: Write tests for StaggeredList and SkeletonCard**
  Create test suites verifying animated opacity changes, stagger delay timers, and pulsing animation logic.
- [ ] **Step 2: Run tests to verify they fail**
  Run: `npm test -- src/ui/StaggeredList.test.tsx src/ui/SkeletonCard.test.tsx --watchAll=false`
  Expected: FAIL.
- [ ] **Step 3: Implement StaggeredList and SkeletonCard**
  Create `frontend/src/ui/StaggeredList.tsx` and `frontend/src/ui/SkeletonCard.tsx`. Ensure `useReducedMotion()` is used to disable animated offsets and timings if active.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm test -- src/ui/StaggeredList.test.tsx src/ui/SkeletonCard.test.tsx --watchAll=false`
  Expected: PASS.
- [ ] **Step 5: Integrate StaggeredList in HomeScreen**
  Modify `frontend/src/features/learn/HomeScreen.tsx` to wrap the dashboard stats cards, review button, and forecast items inside `<StaggeredList>`.
- [ ] **Step 6: Commit**
  Run: `git commit -am "feat(ui): add StaggeredList and SkeletonCard components"`

---

### Task 3: Floating Command Dock

**Files:**
- Create: [CommandDock.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/features/web/CommandDock.tsx)
- Create: [CommandDock.test.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/features/web/CommandDock.test.tsx)
- Modify: [RootNavigator.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/navigation/RootNavigator.tsx)

**Interfaces:**
- `CommandDockProps`: `{}`
- Commands supported:
  - Add Word: `navigation.navigate('Add')`
  - Start Review: `navigation.navigate('Practice')`
  - Search Dictionary: Shows inline overlay dialog
  - Toggle Light/Dark Theme: Calls `toggleMode()` from `useTheme()`

- [ ] **Step 1: Write tests for CommandDock**
  Create tests verifying navigation triggers and theme toggle calls upon clicking dock items.
- [ ] **Step 2: Run tests to verify they fail**
  Run: `npm test -- src/features/web/CommandDock.test.tsx --watchAll=false`
  Expected: FAIL.
- [ ] **Step 3: Implement CommandDock**
  Create `frontend/src/features/web/CommandDock.tsx` using `useTheme`, `useNavigation`, and floating absolute layout. Render the keyboard shortcut tooltips on hover.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm test -- src/features/web/CommandDock.test.tsx --watchAll=false`
  Expected: PASS.
- [ ] **Step 5: Wire CommandDock inside RootNavigator**
  Modify `frontend/src/navigation/RootNavigator.tsx` to render `<CommandDock />` inside the NavigationContainer when `Platform.OS === 'web'`.
- [ ] **Step 6: Commit**
  Run: `git commit -am "feat(web): add floating CommandDock component for web layout"`

---

### Task 4: Inspector Panel

**Files:**
- Create: [InspectorPanel.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/features/web/InspectorPanel.tsx)
- Create: [InspectorPanel.test.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/features/web/InspectorPanel.test.tsx)

**Interfaces:**
- `InspectorPanelProps`:
  ```typescript
  interface InspectorPanelProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }
  ```

- [ ] **Step 1: Write tests for InspectorPanel**
  Create tests verifying sliding animation triggers, visibility bindings, and backdrop dismiss click handler.
- [ ] **Step 2: Run tests to verify they fail**
  Run: `npm test -- src/features/web/InspectorPanel.test.tsx --watchAll=false`
  Expected: FAIL.
- [ ] **Step 3: Implement InspectorPanel**
  Create `frontend/src/features/web/InspectorPanel.tsx` using React Native `Animated` for right-to-left slide-over transitions. Ensure focus traps and `prefers-reduced-motion` are handled.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm test -- src/features/web/InspectorPanel.test.tsx --watchAll=false`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Run: `git commit -am "feat(web): add right slide-over InspectorPanel component"`

---

### Task 5: Deck Canvas Grid

**Files:**
- Create: [DeckCanvas.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/features/words/DeckCanvas.tsx)
- Create: [DeckCanvas.test.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/features/words/DeckCanvas.test.tsx)

**Interfaces:**
- `DeckCanvasProps`:
  ```typescript
  interface DeckCanvasProps {
    decks: Deck[];
    selectedDeckId: string | null;
    onSelectDeck: (deckId: string | null) => void;
    onOpenInfo: (deck: Deck) => void;
    onAddDeck: () => void;
  }
  ```

- [ ] **Step 1: Write tests for DeckCanvas**
  Create tests verifying rendering of deck tiles, progress rings, and hover-triggered word previews.
- [ ] **Step 2: Run tests to verify they fail**
  Run: `npm test -- src/features/words/DeckCanvas.test.tsx --watchAll=false`
  Expected: FAIL.
- [ ] **Step 3: Implement DeckCanvas**
  Create `frontend/src/features/words/DeckCanvas.tsx` as a responsive grid layout. Add hover-sensitive Action chips and dynamic list staggers.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm test -- src/features/words/DeckCanvas.test.tsx --watchAll=false`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Run: `git commit -am "feat(words): add DeckCanvas grid layout"`

---

### Task 6: Contextual Command Bar

**Files:**
- Create: [useSelection.ts](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/hooks/useSelection.ts)
- Create: [useSelection.test.ts](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/hooks/useSelection.test.ts)
- Create: [ContextualCommandBar.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/ui/ContextualCommandBar.tsx)
- Create: [ContextualCommandBar.test.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/ui/ContextualCommandBar.test.tsx)

**Interfaces:**
- `useSelection<T>()`: returns `{ selectedIds: Set<T>, toggle: (id: T) => void, clear: () => void, selectAll: (ids: T[]) => void }`
- `ContextualCommandBarProps`:
  ```typescript
  interface ContextualCommandBarProps {
    visible: boolean;
    selectedCount: number;
    actions: { label: string; icon: string; onPress: () => void }[];
    onClear: () => void;
  }
  ```

- [ ] **Step 1: Write tests for selection hook & bar**
  Create tests verifying batch selection states and floating contextual bar transition properties.
- [ ] **Step 2: Run tests to verify they fail**
  Run: `npm test -- src/hooks/useSelection.test.ts src/ui/ContextualCommandBar.test.tsx --watchAll=false`
  Expected: FAIL.
- [ ] **Step 3: Implement useSelection hook & ContextualCommandBar component**
  Create `frontend/src/hooks/useSelection.ts` and `frontend/src/ui/ContextualCommandBar.tsx`.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm test -- src/hooks/useSelection.test.ts src/ui/ContextualCommandBar.test.tsx --watchAll=false`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Run: `git commit -am "feat(ui): add useSelection hook and ContextualCommandBar component"`

---

### Task 7: Integrate Deck Canvas & Inspector Panel into Words Tab

**Files:**
- Modify: [MyWordsScreen.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/features/words/MyWordsScreen.tsx)
- Modify: [MyWordsScreen.test.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/features/words/MyWordsScreen.test.tsx)

- [ ] **Step 1: Refactor MyWordsScreen to display DeckCanvas on web**
  Update `MyWordsScreen.tsx` to conditionally display the responsive `DeckCanvas` grid layout on Web instead of the horizontal tab bar.
- [ ] **Step 2: Bind InspectorPanel and ContextualCommandBar**
  Connect selected deck and word details to open inside the right-hand `InspectorPanel` on Web, rather than pushing to standard full-page detail views. Integrate `ContextualCommandBar` for batch deck operations.
- [ ] **Step 3: Run MyWordsScreen tests and update assertions**
  Run: `npm test -- src/features/words/MyWordsScreen.test.tsx --watchAll=false`
  Expected: PASS.
- [ ] **Step 4: Commit**
  Run: `git commit -am "feat(words): integrate deck canvas and inspector panel into Words tab screen"`

---

### Task 8: Practice View flip animation & rating micro-interactions

**Files:**
- Modify: [Flashcard.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/features/practice/Flashcard.tsx)
- Modify: [RatingButton.tsx](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/ui/RatingButton.tsx)

- [ ] **Step 1: Support prefers-reduced-motion in Flashcard flip**
  Update `Flashcard.tsx` to read from `useReducedMotion()`. If active, skip the 3D `rotateY` card flip transitions and execute instant opacity swaps.
- [ ] **Step 2: Add hover scale and stagger to RatingButtons**
  Update `RatingButton.tsx` to animate scale transitions on hover and stagger in rating buttons upon answer reveals using a simple `Animated` delay value.
- [ ] **Step 3: Verify practice screen tests**
  Run: `npm test -- src/features/practice/Flashcard.test.tsx --watchAll=false` (or equivalent suite)
  Expected: PASS.
- [ ] **Step 4: Commit**
  Run: `git commit -am "feat(practice): add motion controls and rating button staggers"`

---

### Task 9: Final Polish & Verification

**Files:**
- Modify: [translations.ts](file:///Users/hyungjuyu/Projects/iOs/Project_PN/frontend/src/i18n/translations.ts)

- [ ] **Step 1: Add new UX translation keys**
  Add required display strings (e.g. `settings.languagePairs`, `words.deckCanvasInfo`, `dock.addWord`, `dock.startReview`) to both `en` and `ko` tables in `translations.ts`.
- [ ] **Step 2: Run type check & linter**
  Run: `npx tsc --noEmit` and check for errors.
- [ ] **Step 3: Run the full frontend test suite**
  Run: `npm test -- --watchAll=false`
  Expected: All tests pass.
- [ ] **Step 4: Run the full backend test suite**
  Run: `cd ../backend && DATABASE_URL="postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable" go test ./...`
  Expected: All tests pass.
- [ ] **Step 5: Commit**
  Run: `git commit -am "chore: add translation keys and verify build tests"`

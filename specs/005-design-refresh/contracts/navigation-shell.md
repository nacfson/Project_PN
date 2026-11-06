# Contract: Navigation Shell, Routes and Shortcuts

**Owner modules**: `frontend/src/navigation/MainTabs.tsx`, `Sidebar.tsx`, `shellKind.ts`, `WordsStack.tsx`, `frontend/src/ui/Screen.tsx`, `frontend/src/hooks/useKeyboardShortcut.ts`
**Spec**: FR-007–FR-010, FR-015, FR-026, FR-029, FR-036; US1, US2, US4

## Layout selection

| `shellKind` | Page width (`browserPageWidth(window.width)`) | Layout |
|---|---|---|
| `phone` | any | Bottom tab bar |
| `browser` (web, Tauri) | < 720 | Bottom tab bar |
| `browser` (web, Tauri) | ≥ 720 | Left sidebar (`tabBarPosition: 'left'`) |

When `chromeHidden === true` (an active review session), neither layout renders, and the scene uses the full page.

## Destinations (tab routes)

| Order | Route name (unchanged) | Label key | EN / KO label | Icon (bottom bar) | testID (unchanged) |
|---|---|---|---|---|---|
| 1 | `Learn` | `tabs.today` (new) | Today / 오늘 | home | `tab-button-learn` |
| 2 | `Words` | existing | Words / 단어 | book | `tab-button-words` |
| 3 | `Add` | existing | Add / 추가 | plus | `tab-button-add` |
| 4 | `Practice` | existing | Practice / 연습 | cards | `tab-button-practice` |
| 5 | `Settings` | existing | Settings / 설정 | sliders | `tab-button-settings` |

Route names, `linkingConfig` paths and testIDs stay the same. Only labels, icons and styling change.

## Sidebar anatomy

1. The "PN" mark (display role, 22/500). Pressing it navigates to `Learn`.
2. The five nav items. Each has height 36, a hit area of at least 44, radius 8, and fills with `fill` on hover. The active item has a `fill` background with `text` color and `accessibilityState={{ selected: true }}`.
3. A footer showing the active language pair (for example "English → Korean"), caption style. It is display-only.

The sidebar has flex-basis 232 and a `hairline` right border. The scene takes the remaining width and centers a column of at most 760.

## Bottom bar anatomy

Five equal items with icon (22) and label (micro). Each item has a minimum height of 52, a `hairline` top border and a `canvas` background, plus a bottom safe-area inset. The active item uses `text` color and inactive items use `textMuted`.

## Chrome hiding API

```ts
// frontend/src/ui/Screen.tsx — extends the existing TabBarScrollContext value
interface ShellChromeContext {
  chromeHidden: boolean;
  setChromeHidden(hidden: boolean): void;
}
```

- `PracticeScreen` calls `setChromeHidden(true)` when `status === 'active'`, and `setChromeHidden(false)` when the status changes or the screen unmounts, including when "End session" is chosen.
- This replaces the existing `tabBarTranslateY` hide and `setTabBarInteractive` logic for practice grading chrome. Any remaining scroll-linked hide behavior elsewhere must not conflict with it.

## Words stack routes

| Route | Params | Screen | Notes |
|---|---|---|---|
| `WordsRoot` | `{ deckId?: string }` | `MyWordsScreen` | `deckId` preselects the deck filter. |
| `WordDetail` | existing | `WordDetailScreen` | Hosts the touch equivalents of the row actions (audio, move, delete). |
| `Decks` (new) | — | `DecksScreen` | Opened from the deck filter menu → "Manage decks". Opening a deck navigates to `WordsRoot` with `{ deckId }`. |

**Deck filter menu items** (in order): "All decks", one entry per deck (with its count), a separator, "New deck", "Manage decks". It opens as a bottom sheet on the phone shell (surface uses `PAGE_WIDTH_FRAME` and has `testID="bottom-sheet"`, and is added to `bottomSheetWidth.test.tsx`) and as an anchored menu on the browser shell.

## Keyboard shortcuts (web and Tauri only)

| Screen | Key | Action | Hint chip |
|---|---|---|---|
| Today | Enter | Start review (only when `due > 0`) | On the "Start review" button |
| Add | Enter (input submit) | Find meanings | On the "Find meanings" button |
| Words | `/` | Focus search | Inside the search field |
| Practice | Space or Enter | Reveal answer | On "Show answer" |
| Practice | 1 / 2 / 3 / 4 | Forgot / Hard / Good / Easy | On each rating choice |

The `useKeyboardShortcut(key, handler, { enabled })` hook:
- is a no-op unless `Platform.OS === 'web'`;
- ignores events while an `INPUT`, `TEXTAREA` or contenteditable element has focus (except Enter on the Add input, which is handled natively);
- calls `preventDefault()` when handled;
- unsubscribes on unmount.

`Kbd` chips render only on the browser shell, not the phone shell (FR-036), and are hidden from assistive technology.

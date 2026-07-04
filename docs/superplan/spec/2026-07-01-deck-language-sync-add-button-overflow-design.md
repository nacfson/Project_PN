# Spec: Deck/Language-Pair Sync & Add Button Overflow

This spec fixes two UI/UX issues:

1. The deck system does not update when the user changes the active language pair.
2. The **Add Word** button in the manual-add row is clipped on narrow screens.

---

## 1. Deck / Language-Pair Sync

### Objective
When the user switches the active language pair in **Settings → Language Pairs**, returning to **My Words** or **Add** should show the decks and content for the newly selected language, with a sensible default deck selected.

### Design
- Keep the existing local-fetch pattern (`useActiveTargetLanguage` + `useEffect`).
- Add a `useFocusEffect` hook in both `MyWordsScreen` and `AddScreen` that calls `refreshLanguage()` when the screen regains focus.
- When `targetLanguage` changes, the existing deck-load effect re-runs and fetches decks filtered to that language.
- On deck reload, validate the current `selectedDeckId`. If the previously selected deck does not exist in the new language’s deck list, fall back to:
  1. the default deck (`is_default === true`), or
  2. the first available deck, or
  3. `null` if no decks exist.

### Affected files
- `frontend/src/features/words/MyWordsScreen.tsx`
  - Import `useFocusEffect`.
  - Add `useFocusEffect(() => { refreshLanguage(); }, [refreshLanguage])`.
  - Existing `loadDecks` already resets `selectedDeckId` when the old id is missing.
- `frontend/src/navigation/AddScreen.tsx`
  - Import `useFocusEffect`.
  - Add `useFocusEffect(() => { refreshLanguage(); }, [refreshLanguage])`.
  - Update `setSelectedDeckId` fallback logic to prefer the default deck and reset when the old id is missing.

### Why focus-based refresh?
- It is the smallest change that solves the reported bug.
- It matches the repo’s current data-fetching style (no global state or query cache yet).
- The language switcher lives in a separate settings screen, so focus events cover the actual user flow.

### Future improvement
If an inline language switcher is added to `MyWordsScreen` or `AddScreen`, replace the focus-based refresh with a shared active-language context or query invalidation so the UI reacts immediately without waiting for focus.

---

## 2. Add Button Overflow Fix

### Objective
The **Add Word** button at the end of the manual-add input row must remain fully visible on all screen widths, including mobile and narrow web viewports.

### Design
- Wrap the `Input` in a shrinkable flex container so it can compress below its intrinsic width.
- Add `numberOfLines={1}` to the `Button` label so long labels cannot wrap and push the button out of bounds.

### Affected files
- `frontend/src/features/add/ManualAddSection.tsx`
  - Replace `style={{ flex: 1 }}` on `Input` with a wrapping `<View style={{ flex: 1, minWidth: 0 }} testID="manual-add-input-wrapper">`.
- `frontend/src/ui/Button.tsx`
  - Add `numberOfLines={1}` to the button label `Text` component.

### Why this approach?
- In React Native flex rows, `flex: 1` alone does not allow a child to shrink below its content width unless `minWidth: 0` is set. Wrapping the `Input` fixes the overflow without changing the visual style.
- `numberOfLines={1}` is a defensive guard for any button used in tight horizontal layouts.

---

## 3. Testing

- Add a regression test in `frontend/src/features/add/ManualAddSection.test.tsx` asserting the input wrapper has `{ flex: 1, minWidth: 0 }`.
- Add/update tests in `frontend/src/features/words/MyWordsScreen.test.tsx` and `frontend/src/navigation/AddScreen.test.tsx` to verify:
  - `refreshLanguage` is called on focus.
  - `selectedDeckId` resets to the default/first deck when the language changes and the old deck is not present.

---

## 4. Acceptance Criteria

- [ ] Changing the active language pair and returning to **My Words** shows decks for the new language.
- [ ] Changing the active language pair and returning to **Add** updates the target-deck selector with the new language’s decks.
- [ ] If the previously selected deck does not exist in the new language, a default/fallback deck is selected.
- [ ] The **Add Word** button in the manual-add row is fully visible on a 320 px-wide viewport.
- [ ] All Jest tests pass and TypeScript compiles without errors.

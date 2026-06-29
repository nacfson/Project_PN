# Spec: Vocabulary Learning UX/UI Improvements

This specification outlines the concrete frontend and backend changes required to implement the UX/UI improvements approved in the project audit.

---

## Proposed Changes

### 1. Primary Action Simplification
- **Objective**: Simplify word addition entry points. Maintain the bottom **Add** tab as the singular primary CTA.
- **Changes**:
  - In [HomeScreen.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/features/learn/HomeScreen.tsx), replace the `AddWordModal` trigger with a navigation redirect:
    ```typescript
    onPress={() => navigation.navigate('Add')}
    ```
  - Remove [AddWordModal.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/components/AddWordModal.tsx) entirely to reduce visual inconsistency and code duplication.

### 2. Practice Flow Tightening
- **Objective**: Decongest the card reveal step. Show Answer + Example first; reveal rating buttons sequentially.
- **Changes**:
  - Introduce a new boolean state `showRatingOptions` in [PracticeScreen.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/features/practice/PracticeScreen.tsx).
  - When the card is revealed/flipped (`isFlipped === true`), display the back of the card with the definition and example sentence, along with a primary CTA button: **"Rate Recall"**.
  - Tapping **"Rate Recall"** sets `showRatingOptions` to true, rendering the rating buttons (Again, Hard, Good, Easy) with a smooth fade-in / slide-up animation.
  - Reset `showRatingOptions` to false when moving to the next card.

### 3. Rating Feedback & Transitions
- **Objective**: Provide satisfying visual confirmation after grading a card.
- **Changes**:
  - Implement a card dismiss slide transition in [Flashcard.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/features/practice/Flashcard.tsx) using React Native `Animated`.
  - When a rating is selected, play a quick exit translation (e.g. slide out to the left/right or fade out), wait for 150ms to let the user see the transition, then trigger `confirmGrade` to advance the card index.
  - Show a temporary badge or popover (e.g. `+10 XP`) near the progress bar or on top of the card.

### 4. Simplified Add Screen
- **Objective**: Clean up the Add screen and remove repeating part-of-speech chips.
- **Changes**:
  - Implement a Segmented Tab Control at the top of [AddScreen.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/navigation/AddScreen.tsx) with two tabs: **"From Passage"** and **"Single Word"**.
  - In "From Passage" tab:
    - **Step 1**: Display the text input area.
    - **Step 2 (Conditional)**: If the text is entered, show the tappable word grid.
    - **Step 3 (Conditional)**: If at least one word is selected, show the unified `PosSelector`, deck selector, and the "Add Selected" button.
  - This hides all visual clutter and selector duplication when the user is not actively using those sections.

### 5. Word List Scanability & Backend Integration
- **Objective**: Show Deck and Last Reviewed information on list cards in `MyWordsScreen.tsx`.
- **Changes**:
  - **Backend DTO Upgrade**:
    - Update `LearningItemListItem` struct in [types.go](file:///Users/hyungjuyu/Projects/iOS/Project_PN/backend/internal/words/types.go#L67) to include:
      ```go
      DeckID         string     `json:"deck_id"`
      DeckName       string     `json:"deck_name"`
      LastReviewedAt *time.Time `json:"last_reviewed_at"`
      ```
    - Update the SELECT query in `ListLearningItems` in [service.go](file:///Users/hyungjuyu/Projects/iOS/Project_PN/backend/internal/words/service.go#L376) to select `uws.deck_id::text`, `d.name as deck_name`, and `rs.last_reviewed_at`, joining the `decks d` table.
  - **Frontend Upgrade**:
    - Update `LearningItemListItem` interface in [types/index.ts](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/types/index.ts#L71).
    - Render a compact **Deck Badge** (`📁 {item.deck_name}`) and a **Last Reviewed Time** text (`🕒 Reviewed {relative_time}`) in the list items of [MyWordsScreen.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/features/words/MyWordsScreen.tsx).
    - Truncate definitions to a maximum of 2 lines.

### 6. Accessibility & Semantics Cleanup
- **Objective**: Fix nested interactive elements and increase small touch targets.
- **Changes**:
  - In [Flashcard.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/features/practice/Flashcard.tsx), change the main `Pressable` card wrapper to be disabled when `isFlipped` is true:
    ```typescript
    disabled={isFlipped}
    ```
    This removes the entire back face from behaving as a single giant button, allowing screen readers to traverse individual definition and example text nodes.
  - Add `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}` to [SpeakButton.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/components/SpeakButton.tsx) to ensure its touch target satisfies mobile standards without visually resizing the icon.

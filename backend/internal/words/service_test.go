package words

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestListLearningItemsPopulatesDeckAndReviewDetails(t *testing.T) {
	pool := deckTestPool(t)
	svc := deckTestService(t, pool)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	// 1. Create a custom deck with a specific name
	deckName := "TDD Custom Deck " + fmt.Sprintf("%d", time.Now().UnixNano())
	customDeck, err := svc.CreateDeck(ctx, userID, deckName, "en")
	if err != nil {
		t.Fatalf("failed to create deck: %v", err)
	}

	// 2. Insert a word and add it to the custom deck using a unique lemma
	lemma := fmt.Sprintf("tddword%d", time.Now().UnixNano())
	senseID := insertDeckFixtureWord(t, pool, lemma)
	item, err := svc.AddLearningItem(ctx, userID, senseID, "en", customDeck.ID)
	if err != nil {
		t.Fatalf("failed to add learning item: %v", err)
	}

	// 3. Update the last_reviewed_at timestamp in review_states to a known time
	expectedTime := time.Now().UTC().Truncate(time.Millisecond)
	_, err = pool.Exec(ctx, `
		update review_states
		set last_reviewed_at = $1
		where user_word_sense_id = $2::uuid`,
		expectedTime, item.ID,
	)
	if err != nil {
		t.Fatalf("failed to update review state: %v", err)
	}

	// 4. Query learning items
	page, err := svc.ListLearningItems(ctx, userID, ListLearningItemsParams{
		Limit:        10,
		LanguageCode: "en",
	})
	if err != nil {
		t.Fatalf("failed to list learning items: %v", err)
	}

	// Find our added item in the page (to prevent noise from other dirty data)
	var foundListItem *LearningItemListItem
	for i := range page.Items {
		if page.Items[i].ID == item.ID {
			foundListItem = &page.Items[i]
			break
		}
	}

	if foundListItem == nil {
		t.Fatalf("expected to find learning item with ID %q in page, but it was not returned", item.ID)
	}

	// Verify deck details are populated
	if foundListItem.DeckID != customDeck.ID {
		t.Errorf("expected DeckID %q, got %q", customDeck.ID, foundListItem.DeckID)
	}
	if foundListItem.DeckName != deckName {
		t.Errorf("expected DeckName %q, got %q", deckName, foundListItem.DeckName)
	}

	// Verify last reviewed time is populated
	if foundListItem.LastReviewedAt == nil {
		t.Errorf("expected LastReviewedAt to be non-nil")
	} else {
		// Compare times allowing minor DB round-trip variations
		if !foundListItem.LastReviewedAt.Equal(expectedTime) {
			t.Errorf("expected LastReviewedAt %v, got %v", expectedTime, *foundListItem.LastReviewedAt)
		}
	}
}

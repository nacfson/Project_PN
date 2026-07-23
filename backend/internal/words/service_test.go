package words

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"project-pn/internal/admin"
	"project-pn/internal/enrich"
)

// logLine captures a single admin log entry.
type logLine struct {
	Category string
	Message  string
}

// fakeLogger implements admin.Logger and records every emitted log line.
type fakeLogger struct {
	mu    sync.Mutex
	lines []logLine
}

func (f *fakeLogger) Log(category, message string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lines = append(f.lines, logLine{Category: category, Message: message})
}

func (f *fakeLogger) Logf(category, format string, args ...interface{}) {
	f.Log(category, fmt.Sprintf(format, args...))
}

func (f *fakeLogger) Close() error { return nil }

func (f *fakeLogger) has(category, substr string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, l := range f.lines {
		if l.Category == category && strings.Contains(l.Message, substr) {
			return true
		}
	}
	return false
}

func (f *fakeLogger) count(category, substr string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for _, l := range f.lines {
		if l.Category == category && strings.Contains(l.Message, substr) {
			n++
		}
	}
	return n
}

func (f *fakeLogger) entries() []logLine {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]logLine, len(f.lines))
	copy(out, f.lines)
	return out
}

var _ admin.Logger = (*fakeLogger)(nil)

type stubEnricher struct {
	enrichResult enrich.Result
	enrichErr    error
}

func (s *stubEnricher) Enrich(_ context.Context, _ enrich.Request) (enrich.Result, error) {
	return s.enrichResult, s.enrichErr
}

func (s *stubEnricher) Translate(_ context.Context, _ enrich.TranslateRequest) (enrich.TranslateResult, error) {
	return enrich.TranslateResult{}, nil
}

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

func TestLearningItemsTranslations(t *testing.T) {
	pool := deckTestPool(t)
	svc := deckTestService(t, pool)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	lemma := fmt.Sprintf("trword%d", time.Now().UnixNano())
	senseID := insertDeckFixtureWord(t, pool, lemma)

	// Add learning item
	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "")
	if err != nil {
		t.Fatalf("failed to add learning item: %v", err)
	}

	// 1. Verify LocalizedDefinition in ListLearningItems
	page, err := svc.ListLearningItems(ctx, userID, ListLearningItemsParams{
		Limit:        10,
		LanguageCode: "en",
	})
	if err != nil {
		t.Fatalf("failed to list learning items: %v", err)
	}

	var foundListItem *LearningItemListItem
	for i := range page.Items {
		if page.Items[i].ID == item.ID {
			foundListItem = &page.Items[i]
			break
		}
	}

	if foundListItem == nil {
		t.Fatalf("expected to find learning item %q in page", item.ID)
	}

	expectedTranslation := lemma + " translation"
	if foundListItem.LocalizedDefinition != expectedTranslation {
		t.Errorf("ListLearningItems: expected LocalizedDefinition %q, got %q", expectedTranslation, foundListItem.LocalizedDefinition)
	}

	// 2. Make the review item due
	_, err = pool.Exec(ctx, `
		update review_states
		set due_at = now() - interval '1 hour'
		where user_word_sense_id = $1::uuid`,
		item.ID,
	)
	if err != nil {
		t.Fatalf("failed to make review item due: %v", err)
	}

	// 3. Verify LocalizedDefinition in GetDueReviewItems
	dueItems, err := svc.GetDueReviewItems(ctx, userID, "en", "", 10)
	if err != nil {
		t.Fatalf("failed to get due review items: %v", err)
	}

	var foundDueItem *DueItem
	for i := range dueItems {
		if dueItems[i].UserWordSenseID == item.ID {
			foundDueItem = &dueItems[i]
			break
		}
	}

	if foundDueItem == nil {
		t.Fatalf("expected to find due item %q", item.ID)
	}

	if foundDueItem.LocalizedDefinition != expectedTranslation {
		t.Errorf("GetDueReviewItems: expected LocalizedDefinition %q, got %q", expectedTranslation, foundDueItem.LocalizedDefinition)
	}
}

func TestLookupLogsEnrichFail(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	logger := &fakeLogger{}
	svc := New(pool, &stubEnricher{enrichErr: errors.New("enricher down")}, logger, "", "en", "ko")

	lemma := fmt.Sprintf("enrichfail%d", time.Now().UnixNano())
	_, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "", nil)
	if err == nil {
		t.Fatal("expected enrich failure")
	}

	if !logger.has("ENRICH_FAIL", lemma) {
		t.Fatalf("expected ENRICH_FAIL log containing %q, got %+v", lemma, logger.entries())
	}
}

func TestLookupLogsAddWord(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	logger := &fakeLogger{}
	lemma := fmt.Sprintf("addword%d", time.Now().UnixNano())
	enricher := &stubEnricher{
		enrichResult: enrich.Result{
			NormalizedText: lemma,
			Entries: []enrich.Entry{
				{
					Lemma:        lemma,
					PartOfSpeech: "noun",
					Senses: []enrich.Sense{
						{Definition: "a test word"},
					},
				},
			},
		},
	}
	svc := New(pool, enricher, logger, "", "en", "ko")

	if _, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "", nil); err != nil {
		t.Fatalf("lookup failed: %v", err)
	}

	if !logger.has("ADD_WORD", lemma) {
		t.Fatalf("expected ADD_WORD log containing %q, got %+v", lemma, logger.entries())
	}
}

func TestLookupAddWordNoDuplicateLog(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	logger := &fakeLogger{}
	lemma := fmt.Sprintf("addworddup%d", time.Now().UnixNano())
	enricher := &stubEnricher{
		enrichResult: enrich.Result{
			NormalizedText: lemma,
			Entries: []enrich.Entry{
				{
					Lemma:        lemma,
					PartOfSpeech: "noun",
					Senses: []enrich.Sense{
						{Definition: "a test word"},
					},
				},
			},
		},
	}
	svc := New(pool, enricher, logger, "", "en", "ko")

	if _, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "", nil); err != nil {
		t.Fatalf("first lookup failed: %v", err)
	}
	if _, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "", nil); err != nil {
		t.Fatalf("second lookup failed: %v", err)
	}

	if count := logger.count("ADD_WORD", lemma); count != 1 {
		t.Fatalf("expected exactly one ADD_WORD log containing %q, got %d", lemma, count)
	}
}

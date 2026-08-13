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
	"project-pn/internal/learninglog"
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
	enrichResult    enrich.Result
	enrichErr       error
	translateResult enrich.TranslateResult
	translateErr    error
}

func (s *stubEnricher) Enrich(_ context.Context, _ enrich.Request) (enrich.Result, error) {
	return s.enrichResult, s.enrichErr
}

func (s *stubEnricher) Translate(_ context.Context, _ enrich.TranslateRequest) (enrich.TranslateResult, error) {
	if s.translateErr != nil {
		return enrich.TranslateResult{}, s.translateErr
	}
	return s.translateResult, nil
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
	item, err := svc.AddLearningItem(ctx, userID, senseID, "en", customDeck.ID, "")
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
	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "")
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
	dueItems, err := svc.GetDueReviewItems(ctx, userID, "en", "", "", 10)
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

func TestJapaneseKoreanDueFlowCarriesLocalization(t *testing.T) {
	pool := deckTestPool(t)
	svc := deckTestService(t, pool)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	if _, err := pool.Exec(ctx, `update user_languages set is_active = false where user_id = $1::uuid`, userID); err != nil {
		t.Fatalf("deactivate en pair: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into user_languages (user_id, target_language, display_language, is_active)
		values ($1::uuid, 'ja', 'ko', true)`, userID); err != nil {
		t.Fatalf("insert ja pair: %v", err)
	}

	lemma := fmt.Sprintf("食べる%d", time.Now().UnixNano())
	var wordID string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech, pronunciation)
		values ('ja', $1, $1, 'verb', 'たべる')
		returning id::text`, lemma).Scan(&wordID); err != nil {
		t.Fatalf("insert ja word: %v", err)
	}
	var senseID string
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, short_definition, meaning_order)
		values ($1::uuid, '食物を口に入れて飲み込む', '食事をする', 1)
		returning id::text`, wordID).Scan(&senseID); err != nil {
		t.Fatalf("insert ja sense: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into sense_translations (word_sense_id, language_code, definition, short_definition)
		values ($1::uuid, 'ko', '음식을 입에 넣고 삼키다', '먹다')`, senseID); err != nil {
		t.Fatalf("insert ko sense translation: %v", err)
	}
	var exampleID string
	if err := pool.QueryRow(ctx, `
		insert into examples (word_sense_id, sentence, difficulty_level)
		values ($1::uuid, '私は毎朝パンを食べる。', 'easy')
		returning id::text`, senseID).Scan(&exampleID); err != nil {
		t.Fatalf("insert ja example: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into example_translations (example_id, language_code, translation)
		values ($1::uuid, 'ko', '나는 매일 아침 빵을 먹는다.')`, exampleID); err != nil {
		t.Fatalf("insert ko example translation: %v", err)
	}

	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "")
	if err != nil {
		t.Fatalf("add ja learning item: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		update review_states set due_at = now() - interval '1 hour'
		where user_word_sense_id = $1::uuid`, item.ID); err != nil {
		t.Fatalf("make ja item due: %v", err)
	}

	dueItems, err := svc.GetDueReviewItems(ctx, userID, "ja", "", "", 10)
	if err != nil {
		t.Fatalf("get ja due items: %v", err)
	}
	var found *DueItem
	for i := range dueItems {
		if dueItems[i].UserWordSenseID == item.ID {
			found = &dueItems[i]
			break
		}
	}
	if found == nil {
		t.Fatalf("expected ja due item %q", item.ID)
	}
	if found.LanguageCode != "ja" || found.DisplayLanguageCode != "ko" {
		t.Errorf("expected ja→ko item, got %s→%s", found.LanguageCode, found.DisplayLanguageCode)
	}
	if found.LocalizedDefinition != "음식을 입에 넣고 삼키다" {
		t.Errorf("expected ko localized definition, got %q", found.LocalizedDefinition)
	}
	if found.LocalizedShortDefinition == nil || *found.LocalizedShortDefinition != "먹다" {
		t.Errorf("expected ko localized short definition, got %v", found.LocalizedShortDefinition)
	}
	if len(found.Examples) != 1 {
		t.Fatalf("expected 1 example, got %d", len(found.Examples))
	}
	if found.Examples[0].LocalizedTranslation == nil || *found.Examples[0].LocalizedTranslation != "나는 매일 아침 빵을 먹는다." {
		t.Errorf("expected ko example translation, got %v", found.Examples[0].LocalizedTranslation)
	}

	// Omitting language_code must resolve the active ja→ko pair.
	activeItems, err := svc.GetDueReviewItems(ctx, userID, "", "", "", 10)
	if err != nil {
		t.Fatalf("get due items via active pair: %v", err)
	}
	seen := false
	for i := range activeItems {
		if activeItems[i].UserWordSenseID == item.ID {
			seen = true
			break
		}
	}
	if !seen {
		t.Errorf("expected ja item when resolving the active ja→ko pair")
	}
}

func TestLookupLogsEnrichFail(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	logger := &fakeLogger{}
	svc := New(pool, &stubEnricher{enrichErr: errors.New("enricher down")}, logger, learninglog.NoopLogger{}, "", "en", "ko")

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
	svc := New(pool, enricher, logger, learninglog.NoopLogger{}, "", "en", "ko")

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
	svc := New(pool, enricher, logger, learninglog.NoopLogger{}, "", "en", "ko")

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

func insertEnglishSenseWithoutTranslation(t *testing.T, pool *pgxpool.Pool, lemma, definition string) (wordID, senseID string) {
	t.Helper()
	ctx := context.Background()
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'noun')
		returning id::text`, lemma).Scan(&wordID); err != nil {
		t.Fatalf("insert word: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, $2, 1)
		returning id::text`, wordID, definition).Scan(&senseID); err != nil {
		t.Fatalf("insert sense: %v", err)
	}
	return wordID, senseID
}

func TestAddLearningItemSurfacesTranslateProviderError(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	logger := &fakeLogger{}
	svc := New(pool, &stubEnricher{translateErr: enrich.ErrUnavailable}, logger, learninglog.NoopLogger{}, "", "en", "ko")

	lemma := fmt.Sprintf("notr%d", time.Now().UnixNano())
	_, senseID := insertEnglishSenseWithoutTranslation(t, pool, lemma, "a missing translation")

	_, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "")
	if err == nil {
		t.Fatal("expected add to fail")
	}
	if !errors.Is(err, enrich.ErrUnavailable) {
		t.Fatalf("expected ErrUnavailable to surface on add, got %v", err)
	}
	if errors.Is(err, ErrTranslationUnavailable) {
		t.Fatal("provider errors must not be collapsed into ErrTranslationUnavailable")
	}
	if !logger.has("TRANSLATE_FAIL", lemma) {
		t.Fatalf("expected TRANSLATE_FAIL log containing %q, got %+v", lemma, logger.entries())
	}
}

func TestLookupCacheHitDegradesWhenTranslateFails(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	svc := New(pool, &stubEnricher{translateErr: enrich.ErrUnavailable}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	lemma := fmt.Sprintf("lookupdeg%d", time.Now().UnixNano())
	_, _ = insertEnglishSenseWithoutTranslation(t, pool, lemma, "canonical definition")

	result, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "", nil)
	if err != nil {
		t.Fatalf("lookup cache hit should degrade when translate fails, got %v", err)
	}
	if len(result.SenseOptions) != 1 {
		t.Fatalf("expected 1 sense option, got %d", len(result.SenseOptions))
	}
	if result.SenseOptions[0].LocalizedDefinition != "canonical definition" {
		t.Fatalf("expected canonical fallback, got %q", result.SenseOptions[0].LocalizedDefinition)
	}
}

func TestAddLearningItemSucceedsWhenTranslateCachesDefinition(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	lemma := fmt.Sprintf("addok%d", time.Now().UnixNano())
	_, senseID := insertEnglishSenseWithoutTranslation(t, pool, lemma, "to store energy")

	svc := New(pool, &stubEnricher{
		translateResult: enrich.TranslateResult{
			Senses: []enrich.TranslateSenseResult{{
				SenseID:    senseID,
				Definition: "충전하다",
			}},
		},
	}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "")
	if err != nil {
		t.Fatalf("add after successful translate: %v", err)
	}
	if item.WordSenseID != senseID {
		t.Fatalf("expected sense %s, got %s", senseID, item.WordSenseID)
	}
	var cached string
	if err := pool.QueryRow(ctx, `
		select definition from sense_translations
		where word_sense_id = $1::uuid and language_code = 'ko'`, senseID,
	).Scan(&cached); err != nil {
		t.Fatalf("load cached translation: %v", err)
	}
	if cached != "충전하다" {
		t.Fatalf("expected cached Korean definition, got %q", cached)
	}
}

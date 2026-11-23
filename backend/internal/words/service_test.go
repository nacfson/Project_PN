package words

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

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
	item, err := svc.AddLearningItem(ctx, userID, senseID, "en", customDeck.ID, "", "")
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
	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "", "")
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

	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "", "")
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
						{
							Definition:            "a test word",
							NativeDefinition:      "시험어",
							NativeShortDefinition: "시험어",
						},
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

func TestLookupPersistsMultiWordAsPhrase(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	lemma := fmt.Sprintf("rule of thumb %d", time.Now().UnixNano())
	enricher := &stubEnricher{
		enrichResult: enrich.Result{
			NormalizedText: lemma,
			Entries: []enrich.Entry{
				{
					Lemma:        lemma,
					PartOfSpeech: "noun",
					Senses: []enrich.Sense{
						{
							Definition:            "a practical method based on experience",
							ShortDefinition:       "practical method",
							NativeDefinition:      "경험칙",
							NativeShortDefinition: "경험칙",
						},
					},
				},
			},
		},
	}
	svc := New(pool, enricher, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	result, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "", nil)
	if err != nil {
		t.Fatalf("lookup failed: %v", err)
	}
	if len(result.SenseOptions) == 0 {
		t.Fatal("expected at least one sense option")
	}
	for _, opt := range result.SenseOptions {
		if opt.PartOfSpeech != "phrase" {
			t.Fatalf("expected phrase POS on sense option, got %q for %+v", opt.PartOfSpeech, opt)
		}
	}

	var storedPOS string
	if err := pool.QueryRow(ctx, `
		select part_of_speech from words
		where language_code = 'en' and normalized_text = $1
	`, lemma).Scan(&storedPOS); err != nil {
		t.Fatalf("query stored word: %v", err)
	}
	if storedPOS != "phrase" {
		t.Fatalf("expected stored POS phrase, got %q", storedPOS)
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
						{
							Definition:            "a test word",
							NativeDefinition:      "시험어",
							NativeShortDefinition: "시험어",
						},
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

	_, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "", "")
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

	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "", "")
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

func TestNormalizeStripsOuterPunctuation(t *testing.T) {
	cases := map[string]string{
		"procurement,":      "procurement",
		"  Procurement, ":   "procurement",
		"\"Implicitly\".":   "implicitly",
		"(intertwined);":    "intertwined",
		"don't":             "don't",
		"rule of thumb.":    "rule of thumb",
		" , . ; ":           "",
	}
	for input, want := range cases {
		if got := normalize(input); got != want {
			t.Errorf("normalize(%q) = %q, want %q", input, got, want)
		}
	}
}

type countingEnricher struct {
	stubEnricher
	enrichCalls int
}

func (c *countingEnricher) Enrich(ctx context.Context, req enrich.Request) (enrich.Result, error) {
	c.enrichCalls++
	return c.stubEnricher.Enrich(ctx, req)
}

func TestLookupDegradesToCanonicalSensesWithTranslationMissing(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	lemma := fmt.Sprintf("canonicalonly%d", time.Now().UnixNano())
	svc := New(pool, &stubEnricher{
		enrichResult: enrich.Result{
			NormalizedText: lemma,
			Entries: []enrich.Entry{{
				Lemma:        lemma,
				PartOfSpeech: "noun",
				Senses: []enrich.Sense{{
					Definition:      "a canonical English meaning without Korean",
					ShortDefinition: "canonical meaning",
				}},
			}},
		},
		enrichErr: enrich.ErrNoDisplayGloss,
	}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	res, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "", nil)
	if err != nil {
		t.Fatalf("expected degraded 200 lookup, got %v", err)
	}
	if !res.TranslationMissing {
		t.Fatal("expected TranslationMissing=true")
	}
	if len(res.SenseOptions) != 1 || res.SenseOptions[0].Definition != "a canonical English meaning without Korean" {
		t.Fatalf("unexpected sense options: %+v", res.SenseOptions)
	}
	if res.SenseOptions[0].HasLocalizedTranslation {
		t.Fatal("expected HasLocalizedTranslation=false")
	}
}

func TestAddLearningItemAllowsUntranslatedSenseWithPersonalNote(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	lemma := fmt.Sprintf("untransnote%d", time.Now().UnixNano())
	_, senseID := insertEnglishSenseWithoutTranslation(t, pool, lemma, "untranslated definition")

	// Without personal_note and ErrNoDisplayGloss from Translate -> ErrTranslationUnavailable (not ErrUnavailable).
	svcMissing := New(pool, &stubEnricher{translateErr: enrich.ErrNoDisplayGloss}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")
	if _, err := svcMissing.AddLearningItem(ctx, userID, senseID, "ko", "", "", ""); !errors.Is(err, ErrTranslationUnavailable) {
		t.Fatalf("expected ErrTranslationUnavailable, got %v", err)
	}

	// With personal_note -> succeeds even when sense_translations is missing.
	item, err := svcMissing.AddLearningItem(ctx, userID, senseID, "ko", "", "", "내가 정한 뜻")
	if err != nil {
		t.Fatalf("expected add with personal_note to succeed, got %v", err)
	}
	if item.PersonalNote == nil || *item.PersonalNote != "내가 정한 뜻" {
		t.Fatalf("expected personal_note saved, got %v", item.PersonalNote)
	}
}

func TestCleanManualLemma(t *testing.T) {
	cases := []struct {
		in        string
		wantClean string
		wantNorm  string
	}{
		{in: `  "Glorp"  `, wantClean: "Glorp", wantNorm: "glorp"},
		{in: "  OpenAI, API! ", wantClean: "OpenAI API", wantNorm: "openai api"},
		{in: "rock , roll", wantClean: "rock roll", wantNorm: "rock roll"},
		{in: "McDonald's.", wantClean: "McDonald's", wantNorm: "mcdonald's"},
	}
	for _, tc := range cases {
		gotClean := cleanManualLemma(tc.in)
		if gotClean != tc.wantClean {
			t.Fatalf("cleanManualLemma(%q) = %q, want %q", tc.in, gotClean, tc.wantClean)
		}
		if again := cleanManualLemma(gotClean); again != gotClean {
			t.Fatalf("cleanManualLemma(%q) not idempotent: %q", tc.in, again)
		}
		if gotNorm := normalize(tc.in); gotNorm != tc.wantNorm || gotNorm != strings.ToLower(gotClean) {
			t.Fatalf("normalize(%q) = %q, want %q and strings.ToLower(%q)", tc.in, gotNorm, tc.wantNorm, gotClean)
		}
	}
}

func TestAddManualLearningItemDoesNotPolluteDictionaryLookup(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	lemma := fmt.Sprintf("ManualOnly%d", time.Now().UnixNano())
	normalized := strings.ToLower(lemma)
	enricher := &countingEnricher{
		stubEnricher: stubEnricher{enrichErr: enrich.ErrWordNotFound},
	}
	svc := New(pool, enricher, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	item, err := svc.AddManualLearningItem(ctx, userID, lemma, "noun", "en", "ko", "", "In a sentence.", "직접 쓴 뜻")
	if err != nil {
		t.Fatalf("AddManualLearningItem: %v", err)
	}
	if !item.IsCustom || item.WordSenseID != "" {
		t.Fatalf("expected custom card with empty WordSenseID, got %+v", item)
	}
	if item.PersonalNote == nil || *item.PersonalNote != "직접 쓴 뜻" {
		t.Fatalf("expected personal_note, got %v", item.PersonalNote)
	}

	var globalWordCount int
	if err := pool.QueryRow(ctx, `select count(*) from words where normalized_text = $1`, normalized).Scan(&globalWordCount); err != nil {
		t.Fatalf("count global words: %v", err)
	}
	if globalWordCount != 0 {
		t.Fatalf("expected zero rows in global words table, got %d", globalWordCount)
	}

	var storedLemma, storedPOS, storedMeaning string
	if err := pool.QueryRow(ctx, `
		select lemma, part_of_speech, meaning
		from user_personal_meanings
		where user_word_sense_id = $1::uuid`, item.ID,
	).Scan(&storedLemma, &storedPOS, &storedMeaning); err != nil {
		t.Fatalf("query user_personal_meanings: %v", err)
	}
	if storedLemma != lemma || storedPOS != "noun" || storedMeaning != "직접 쓴 뜻" {
		t.Fatalf("unexpected custom row: lemma=%q pos=%q meaning=%q", storedLemma, storedPOS, storedMeaning)
	}

	// Empty SetPersonalNote must be rejected on custom cards.
	if _, err := svc.SetPersonalNote(ctx, userID, item.ID, "  "); !errors.Is(err, ErrPersonalNoteRequired) {
		t.Fatalf("expected ErrPersonalNoteRequired on empty note, got %v", err)
	}

	// ListLearningItems prefix search matches lower(pm.lemma).
	page, err := svc.ListLearningItems(ctx, userID, ListLearningItemsParams{Limit: 20, Search: normalized[:10]})
	if err != nil {
		t.Fatalf("ListLearningItems: %v", err)
	}
	if len(page.Items) != 1 || !page.Items[0].IsCustom || page.Items[0].Lemma != lemma || page.Items[0].Definition != "직접 쓴 뜻" {
		t.Fatalf("unexpected listed custom item: %+v", page.Items)
	}

	// Shared dictionary lookup must miss global cache and hit the enricher.
	if _, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "", nil); !errors.Is(err, enrich.ErrWordNotFound) {
		t.Fatalf("expected Lookup to miss dictionary and return ErrWordNotFound, got %v", err)
	}
	if enricher.enrichCalls != 1 {
		t.Fatalf("expected 1 enrich call, got %d", enricher.enrichCalls)
	}

	// Padded language codes must deduplicate onto the same custom card and NOT evict the negative lookup cache.
	dupItem, err := svc.AddManualLearningItem(ctx, userID, lemma, "noun", " en ", " ko ", "", "", "패딩 언어 뜻")
	if err != nil {
		t.Fatalf("AddManualLearningItem with padded langs: %v", err)
	}
	if dupItem.ID != item.ID {
		t.Fatalf("expected padded language_code to deduplicate onto %q, got %q", item.ID, dupItem.ID)
	}
	if _, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "", nil); !errors.Is(err, enrich.ErrWordNotFound) {
		t.Fatalf("expected cached ErrWordNotFound on repeat Lookup, got %v", err)
	}
	if enricher.enrichCalls != 1 {
		t.Fatalf("expected AddManualLearningItem not to evict negative cache (want 1 enrich call, got %d)", enricher.enrichCalls)
	}

	// ArchiveLearningItems works on custom cards.
	archivedCount, err := svc.ArchiveLearningItems(ctx, userID, []string{item.ID})
	if err != nil || archivedCount != 1 {
		t.Fatalf("ArchiveLearningItems count=%d err=%v", archivedCount, err)
	}
}

func TestCustomCardUpgradeSameSenseAndLegacyNoteDrain(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()
	svc := New(pool, &stubEnricher{}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	lemma := fmt.Sprintf("UpgradeMe%d", time.Now().UnixNano())
	normalized := strings.ToLower(lemma)

	customItem, err := svc.AddManualLearningItem(ctx, userID, lemma, "unknown", "en", "ko", "", "", "내 커스텀 뜻")
	if err != nil {
		t.Fatalf("AddManualLearningItem: %v", err)
	}

	var wordID, dictSenseA, dictSenseB string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'noun') returning id::text
	`, normalized).Scan(&wordID); err != nil {
		t.Fatal(err)
	}
	for i, def := range []string{"dictionary meaning A", "dictionary meaning B"} {
		var sid string
		if err := pool.QueryRow(ctx, `
			insert into word_senses (word_id, definition, meaning_order)
			values ($1::uuid, $2, $3) returning id::text
		`, wordID, def, i+1).Scan(&sid); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `
			insert into sense_translations (word_sense_id, language_code, definition)
			values ($1::uuid, 'ko', $2)
		`, sid, "사전 뜻"); err != nil {
			t.Fatal(err)
		}
		if i == 0 {
			dictSenseA = sid
		} else {
			dictSenseB = sid
		}
	}

	// Seed an archived duplicate on dictSenseA to verify conflict cleanup on upgrade.
	archItem, err := svc.AddLearningItem(ctx, userID, dictSenseA, "ko", "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ArchiveLearningItems(ctx, userID, []string{archItem.ID}); err != nil {
		t.Fatal(err)
	}

	// Upgrade custom -> dictionary with omitted note clears user_personal_meanings.
	upgraded, err := svc.ChangeLearningItemSense(ctx, userID, customItem.ID, dictSenseA, "ko", nil)
	if err != nil {
		t.Fatalf("ChangeLearningItemSense upgrade: %v", err)
	}
	if upgraded.IsCustom || upgraded.WordSenseID != dictSenseA || upgraded.PersonalNote != nil {
		t.Fatalf("unexpected upgraded item: %+v", upgraded)
	}
	var pmCount int
	if err := pool.QueryRow(ctx, `select count(*) from user_personal_meanings where user_word_sense_id = $1::uuid`, customItem.ID).Scan(&pmCount); err != nil {
		t.Fatal(err)
	}
	if pmCount != 0 {
		t.Fatalf("expected custom user_personal_meanings row deleted on upgrade, got %d", pmCount)
	}

	// Same-sense dictionary note update + clear (case c) stores/clears user_personal_meanings with lemma = null.
	note := "사전 + 내 메모"
	withNote, err := svc.ChangeLearningItemSense(ctx, userID, customItem.ID, dictSenseA, "ko", &note)
	if err != nil {
		t.Fatal(err)
	}
	if withNote.PersonalNote == nil || *withNote.PersonalNote != note {
		t.Fatalf("expected same-sense note set, got %v", withNote.PersonalNote)
	}
	var pmLemma *string
	if err := pool.QueryRow(ctx, `select lemma from user_personal_meanings where user_word_sense_id = $1::uuid`, customItem.ID).Scan(&pmLemma); err != nil {
		t.Fatal(err)
	}
	if pmLemma != nil {
		t.Fatalf("expected nil lemma on dictionary card override, got %v", *pmLemma)
	}
	empty := ""
	cleared, err := svc.ChangeLearningItemSense(ctx, userID, customItem.ID, dictSenseA, "ko", &empty)
	if err != nil {
		t.Fatal(err)
	}
	if cleared.PersonalNote != nil {
		t.Fatalf("expected same-sense clear, got %v", cleared.PersonalNote)
	}

	// Re-saving identical text or clearing a whitespace-only legacy uws.personal_note drains it without resurrection.
	itemB, err := svc.AddLearningItem(ctx, userID, dictSenseB, "ko", "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `update user_word_senses set personal_note = 'legacy note' where id = $1::uuid`, itemB.ID); err != nil {
		t.Fatal(err)
	}
	resaved, err := svc.SetPersonalNote(ctx, userID, itemB.ID, "legacy note")
	if err != nil {
		t.Fatal(err)
	}
	if resaved.PersonalNote == nil || *resaved.PersonalNote != "legacy note" {
		t.Fatalf("expected legacy note migrated to user_personal_meanings, got %v", resaved.PersonalNote)
	}
	var pmMeaning string
	if err := pool.QueryRow(ctx, `select meaning from user_personal_meanings where user_word_sense_id = $1::uuid`, itemB.ID).Scan(&pmMeaning); err != nil {
		t.Fatal(err)
	}
	if pmMeaning != "legacy note" {
		t.Fatalf("expected user_personal_meanings meaning 'legacy note', got %q", pmMeaning)
	}
	var legacyCol *string
	if err := pool.QueryRow(ctx, `select personal_note from user_word_senses where id = $1::uuid`, itemB.ID).Scan(&legacyCol); err != nil {
		t.Fatal(err)
	}
	if legacyCol != nil {
		t.Fatalf("expected user_word_senses.personal_note nulled on identical resave, got %q", *legacyCol)
	}

	if _, err := pool.Exec(ctx, `delete from user_personal_meanings where user_word_sense_id = $1::uuid`, itemB.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `update user_word_senses set personal_note = '   ' where id = $1::uuid`, itemB.ID); err != nil {
		t.Fatal(err)
	}
	drained, err := svc.SetPersonalNote(ctx, userID, itemB.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if drained.PersonalNote != nil {
		t.Fatalf("expected drained legacy note to be nil, got %v", drained.PersonalNote)
	}
	if err := pool.QueryRow(ctx, `select personal_note from user_word_senses where id = $1::uuid`, itemB.ID).Scan(&legacyCol); err != nil {
		t.Fatal(err)
	}
	if legacyCol != nil {
		t.Fatalf("expected whitespace-only user_word_senses.personal_note nulled, got %q", *legacyCol)
	}
}

func TestAnkiImportIsolationAndCustomSiblingBurying(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()
	svc := New(pool, &stubEnricher{enrichErr: enrich.ErrWordNotFound}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	customDeck, err := svc.CreateDeck(ctx, userID, "My Anki Deck", "en")
	if err != nil {
		t.Fatal(err)
	}

	existingLemma := fmt.Sprintf("ankidict%d", time.Now().UnixNano())
	existingSense := insertDeckFixtureWord(t, pool, existingLemma)
	dictItem, err := svc.AddLearningItem(ctx, userID, existingSense, "ko", customDeck.ID, "", "")
	if err != nil {
		t.Fatal(err)
	}

	degradedLemma := fmt.Sprintf("ankidegraded%d", time.Now().UnixNano())
	var degradedWordID, degradedSenseID string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'noun') returning id::text
	`, degradedLemma).Scan(&degradedWordID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, 'canonical untran gloss', 1) returning id::text
	`, degradedWordID).Scan(&degradedSenseID); err != nil {
		t.Fatal(err)
	}

	unlistedLemma := fmt.Sprintf("ankiunlisted%d", time.Now().UnixNano())
	importRes, err := svc.ImportAnkiCards(ctx, userID, AnkiImportRequest{
		LanguageCode:           "en",
		DefinitionLanguageCode: "ko",
		Cards: []AnkiCard{
			{Front: existingLemma, Back: "내 덮어쓰기 뜻", Action: ImportActionOverwriteMeaning},
			{Front: unlistedLemma, Back: "개인 암기 뜻", Action: ImportActionAdd},
			{Front: degradedLemma, Back: "canonical untran gloss", Action: ImportActionAdd},
		},
	})
	if err != nil {
		t.Fatalf("ImportAnkiCards: %v", err)
	}
	if importRes.Imported != 3 || importRes.Failed != 0 {
		t.Fatalf("unexpected import result: %+v", importRes)
	}

	// Global word_senses.definition must stay untouched; user overrides and custom cards live in user_personal_meanings and keep custom deck.
	var globalDef, currentDeckID string
	if err := pool.QueryRow(ctx, `select definition from word_senses where id = $1::uuid`, existingSense).Scan(&globalDef); err != nil {
		t.Fatal(err)
	}
	if globalDef == "내 덮어쓰기 뜻" {
		t.Fatal("importOverwriteMeaning mutated global word_senses.definition")
	}
	if err := pool.QueryRow(ctx, `select deck_id::text from user_word_senses where id = $1::uuid`, dictItem.ID).Scan(&currentDeckID); err != nil {
		t.Fatal(err)
	}
	if currentDeckID != customDeck.ID {
		t.Fatalf("expected custom deck preserved %q, got %q", customDeck.ID, currentDeckID)
	}
	var overrideLemma *string
	var overrideMeaning string
	if err := pool.QueryRow(ctx, `
		select lemma, meaning from user_personal_meanings where user_word_sense_id = $1::uuid
	`, dictItem.ID).Scan(&overrideLemma, &overrideMeaning); err != nil {
		t.Fatalf("load overwritten personal meaning: %v", err)
	}
	if overrideLemma != nil || overrideMeaning != "내 덮어쓰기 뜻" {
		t.Fatalf("unexpected overwritten personal meaning: lemma=%v meaning=%q", overrideLemma, overrideMeaning)
	}

	var unlistedWords int
	if err := pool.QueryRow(ctx, `select count(*) from words where normalized_text = $1`, unlistedLemma).Scan(&unlistedWords); err != nil {
		t.Fatal(err)
	}
	if unlistedWords != 0 {
		t.Fatalf("expected unlisted Anki word isolated from global words, got %d", unlistedWords)
	}
	var unlistedMeaning string
	if err := pool.QueryRow(ctx, `
		select pm.meaning
		from user_word_senses uws
		join user_personal_meanings pm on pm.user_word_sense_id = uws.id
		where uws.user_id = $1::uuid and uws.word_sense_id is null and lower(pm.lemma) = $2
	`, userID, unlistedLemma).Scan(&unlistedMeaning); err != nil {
		t.Fatalf("load unlisted custom card personal meaning: %v", err)
	}
	if unlistedMeaning != "개인 암기 뜻" {
		t.Fatalf("expected unlisted custom meaning '개인 암기 뜻', got %q", unlistedMeaning)
	}

	var degradedLemmaPtr *string
	var degradedMeaning string
	if err := pool.QueryRow(ctx, `
		select pm.lemma, pm.meaning
		from user_word_senses uws
		join user_personal_meanings pm on pm.user_word_sense_id = uws.id
		where uws.user_id = $1::uuid and uws.word_sense_id = $2::uuid
	`, userID, degradedSenseID).Scan(&degradedLemmaPtr, &degradedMeaning); err != nil {
		t.Fatalf("load degraded dictionary personal meaning: %v", err)
	}
	if degradedLemmaPtr != nil || degradedMeaning != "canonical untran gloss" {
		t.Fatalf("unexpected degraded canonical override: lemma=%v meaning=%q", degradedLemmaPtr, degradedMeaning)
	}

	// Due queue + RecordBatchReviewAttempts + cross-kind sibling burying on shared normalized lemma.
	sibCustom, err := svc.AddManualLearningItem(ctx, userID, existingLemma, "verb", "en", "ko", "", "", "커스텀 품사 뜻")
	if err != nil {
		t.Fatal(err)
	}
	dueBefore, err := svc.GetDueReviewItems(ctx, userID, "en", "", "", 50)
	if err != nil {
		t.Fatal(err)
	}
	var foundSib bool
	for _, d := range dueBefore {
		if d.UserWordSenseID == sibCustom.ID {
			foundSib = true
			if !d.IsCustom {
				t.Fatalf("expected due custom card IsCustom=true")
			}
		}
	}
	if !foundSib {
		t.Fatalf("expected custom sibling card in due queue")
	}

	if _, err := svc.RecordBatchReviewAttempts(ctx, userID, []ReviewAttemptParams{{
		UserWordSenseID: dictItem.ID,
		ActivityType:    "word_to_meaning",
		IsCorrect:       true,
		RatingScore:     2,
	}}); err != nil {
		t.Fatalf("RecordBatchReviewAttempts: %v", err)
	}
	dueAfter, err := svc.GetDueReviewItems(ctx, userID, "en", "", "", 50)
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range dueAfter {
		if d.UserWordSenseID == sibCustom.ID {
			t.Fatalf("expected custom sibling %q to be buried after reviewing dictionary sibling", sibCustom.ID)
		}
	}
}


package words

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"project-pn/internal/enrich"
	"project-pn/internal/learninglog"
)

func TestPhraseLookupDraftWhenEnrichFailsThenAddLearningItem(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	logger := &fakeLogger{}
	svc := New(pool, &stubEnricher{enrichErr: enrich.ErrUnavailable}, logger, learninglog.NoopLogger{}, "", "en", "ko")

	lemma := fmt.Sprintf("look up %d", time.Now().UnixNano())
	pos := "phrase"
	result, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "Please look up the word.", &pos)
	if err != nil {
		t.Fatalf("phrase draft lookup: %v", err)
	}
	if len(result.SenseOptions) == 0 {
		t.Fatal("expected draft sense options")
	}
	opt := result.SenseOptions[0]
	if opt.PartOfSpeech != "phrase" {
		t.Fatalf("got POS %q want phrase", opt.PartOfSpeech)
	}
	if opt.LocalizedShortDefinition == nil || *opt.LocalizedShortDefinition == "" {
		t.Fatal("expected localized short gloss for draft phrase")
	}
	if !logger.has("PHRASE_DRAFT", lemma) {
		t.Fatalf("expected PHRASE_DRAFT log, got %+v", logger.entries())
	}

	deckID, err := svc.EnsureDefaultDeck(ctx, userID, "en")
	if err != nil {
		t.Fatalf("ensure deck: %v", err)
	}
	item, err := svc.AddLearningItem(ctx, userID, opt.WordSenseID, "ko", deckID, "Please look up the word.", "")
	if err != nil {
		t.Fatalf("add phrase learning item: %v", err)
	}

	var count int
	if err := pool.QueryRow(ctx, `
		select count(*) from user_word_senses
		where id = $1::uuid and user_id = $2::uuid and word_sense_id = $3::uuid and archived_at is null`,
		item.ID, userID, opt.WordSenseID,
	).Scan(&count); err != nil {
		t.Fatalf("count user_word_senses: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 user_word_senses row, got %d", count)
	}

	var reviewCount int
	if err := pool.QueryRow(ctx, `
		select count(*) from review_states where user_word_sense_id = $1::uuid`,
		item.ID,
	).Scan(&reviewCount); err != nil {
		t.Fatalf("count review_states: %v", err)
	}
	if reviewCount != 1 {
		t.Fatalf("expected 1 review_states row, got %d", reviewCount)
	}
}

func TestSingleWordLookupStillFailsWhenEnrichFails(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	svc := New(pool, &stubEnricher{enrichErr: errors.New("down")}, &fakeLogger{}, learninglog.NoopLogger{}, "", "en", "ko")
	lemma := fmt.Sprintf("singlefail%d", time.Now().UnixNano())
	_, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "", nil)
	if err == nil {
		t.Fatal("single-word lookup must still fail without enricher")
	}
}

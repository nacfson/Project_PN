package words

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"project-pn/internal/admin"
	"project-pn/internal/enrich"
	"project-pn/internal/learninglog"
)

func insertVerbSense(t *testing.T, pool *pgxpool.Pool, lemma, definition, localized string) (wordID, senseID string) {
	t.Helper()
	ctx := context.Background()
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'verb') returning id::text
	`, lemma).Scan(&wordID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, short_definition, meaning_order)
		values ($1::uuid, $2, $2, 1) returning id::text
	`, wordID, definition).Scan(&senseID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		insert into sense_translations (word_sense_id, language_code, definition, short_definition)
		values ($1::uuid, 'ko', $2, $2)
	`, senseID, localized); err != nil {
		t.Fatal(err)
	}
	return wordID, senseID
}

func TestForceGeneratePersistsFilteredSharedSense(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()
	lemma := fmt.Sprintf("forceok%d", time.Now().UnixNano())
	wordID, _ := insertVerbSense(t, pool, lemma, "to store energy", "충전하다")

	llm := &stubEnricher{enrichResult: enrich.Result{
		NormalizedText: lemma,
		Entries: []enrich.Entry{{
			Lemma:        lemma,
			PartOfSpeech: "verb",
			Senses: []enrich.Sense{{
				Definition:            "to request payment",
				ShortDefinition:       "bill",
				NativeDefinition:      "청구하다",
				NativeShortDefinition: "청구하다",
			}},
		}},
	}}
	primary := &stubEnricher{enrichErr: enrich.ErrUnavailable}
	svc := New(pool, enrich.NewFallback(primary, llm, slog.Default()), admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	result, err := svc.ForceGenerate(ctx, userID, &wordID, lemma, "en", "ko", "Please charge the invoice today.", nil)
	if err != nil {
		t.Fatalf("force generate: %v", err)
	}
	found := false
	for _, opt := range result.SenseOptions {
		if opt.LocalizedDefinition == "청구하다" || (opt.LocalizedShortDefinition != nil && *opt.LocalizedShortDefinition == "청구하다") {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected persisted 청구하다, got %+v", result.SenseOptions)
	}

	second, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "", nil)
	if err != nil {
		t.Fatalf("second lookup: %v", err)
	}
	found = false
	for _, opt := range second.SenseOptions {
		if opt.LocalizedDefinition == "청구하다" || (opt.LocalizedShortDefinition != nil && *opt.LocalizedShortDefinition == "청구하다") {
			found = true
		}
	}
	if !found {
		t.Fatal("second lookup should return the shared generated sense")
	}
}

func TestForceGenerateRejectsWhenFilterEmptiesBatch(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()
	lemma := fmt.Sprintf("forceempty%d", time.Now().UnixNano())
	wordID, _ := insertVerbSense(t, pool, lemma, "to store energy", "충전하다")

	svc := New(pool, &stubEnricher{enrichResult: enrich.Result{
		NormalizedText: lemma,
		Entries: []enrich.Entry{{
			Lemma:        lemma,
			PartOfSpeech: "verb",
			Senses: []enrich.Sense{{
				Definition:            "to store energy in a battery",
				NativeDefinition:      "충전하다",
				NativeShortDefinition: "충전하다",
			}},
		}},
	}}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	_, err := svc.ForceGenerate(ctx, userID, &wordID, lemma, "en", "ko", "", nil)
	if !errors.Is(err, ErrNoAdditionalSense) {
		t.Fatalf("expected ErrNoAdditionalSense, got %v", err)
	}
}

func TestForceGenerateUnavailableWithoutFallback(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()
	lemma := fmt.Sprintf("forcenollm%d", time.Now().UnixNano())
	wordID, _ := insertVerbSense(t, pool, lemma, "to store energy", "충전하다")

	svc := New(pool, &stubEnricher{enrichErr: enrich.ErrUnavailable}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")
	_, err := svc.ForceGenerate(ctx, userID, &wordID, lemma, "en", "ko", "invoice context", nil)
	if !errors.Is(err, enrich.ErrUnavailable) {
		t.Fatalf("expected ErrUnavailable, got %v", err)
	}
}

func TestLookupRanksByContextSimilarity(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()
	lemma := fmt.Sprintf("rank%d", time.Now().UnixNano())
	wordID, _ := insertVerbSense(t, pool, lemma, "to accuse formally", "기소하다")
	if _, err := pool.Exec(ctx, `
		insert into word_senses (word_id, definition, short_definition, meaning_order)
		values ($1::uuid, 'to store energy in a battery', 'store energy', 2)
	`, wordID); err != nil {
		t.Fatal(err)
	}
	var batteryID string
	if err := pool.QueryRow(ctx, `
		select id::text from word_senses where word_id = $1::uuid and meaning_order = 2
	`, wordID).Scan(&batteryID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		insert into sense_translations (word_sense_id, language_code, definition, short_definition)
		values ($1::uuid, 'ko', '충전하다', '충전하다')
	`, batteryID); err != nil {
		t.Fatal(err)
	}

	svc := New(pool, &stubEnricher{}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")
	result, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "Please charge the battery overnight.", nil)
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	if len(result.SenseOptions) < 2 {
		t.Fatalf("options=%d", len(result.SenseOptions))
	}
	if result.SenseOptions[0].WordSenseID != batteryID {
		t.Fatalf("expected battery first, got %s (%s)", result.SenseOptions[0].WordSenseID, result.SenseOptions[0].LocalizedDefinition)
	}
	if result.SenseOptions[0].Similarity == nil {
		t.Fatal("expected similarity on ranked options")
	}
}

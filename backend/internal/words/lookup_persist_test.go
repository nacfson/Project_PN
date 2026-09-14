package words

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"project-pn/internal/admin"
	"project-pn/internal/enrich"
	"project-pn/internal/learninglog"
)

func TestLookupPersistCollapsesBluntLikeSharedShortGlosses(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()
	lemma := fmt.Sprintf("bluntlike%d", time.Now().UnixNano())

	svc := New(pool, &stubEnricher{enrichResult: enrich.Result{
		NormalizedText: lemma,
		Entries: []enrich.Entry{{
			Lemma:        lemma,
			PartOfSpeech: "adjective",
			Senses: []enrich.Sense{
				{
					Definition:            "having a dull edge or point",
					NativeDefinition:      "날이 무딘",
					NativeShortDefinition: "무딘",
				},
				{
					Definition:            "not sharp in feeling or perception",
					NativeDefinition:      "감각이 무딘",
					NativeShortDefinition: "무딘",
				},
				{
					Definition:            "abrupt or frank in manner",
					NativeDefinition:      "직설적인 말투의",
					NativeShortDefinition: "직설적인",
				},
				{
					Definition:            "direct and to the point without delicacy",
					NativeDefinition:      "매우 직설적인",
					NativeShortDefinition: "직설적인",
				},
			},
		}},
	}}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	result, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "", nil)
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	if len(result.SenseOptions) != 2 {
		t.Fatalf("sense options=%d want 2 unique simple glosses; got %+v", len(result.SenseOptions), result.SenseOptions)
	}
	glosses := map[string]bool{}
	for _, opt := range result.SenseOptions {
		g := opt.LocalizedDefinition
		if opt.LocalizedShortDefinition != nil && *opt.LocalizedShortDefinition != "" {
			g = *opt.LocalizedShortDefinition
		}
		glosses[g] = true
	}
	if !glosses["무딘"] || !glosses["직설적인"] {
		t.Fatalf("expected 무딘 and 직설적인, got %#v", glosses)
	}

	var senseCount int
	if err := pool.QueryRow(ctx, `
		select count(*) from word_senses ws
		join words w on w.id = ws.word_id
		where w.normalized_text = $1`, lemma).Scan(&senseCount); err != nil {
		t.Fatal(err)
	}
	if senseCount != 2 {
		t.Fatalf("db sense rows=%d want 2", senseCount)
	}
}

func TestLookupPersistReturnsErrNoSensesWhenFilterEmptiesBatch(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()
	lemma := fmt.Sprintf("emptyfilt%d", time.Now().UnixNano())

	svc := New(pool, &stubEnricher{enrichResult: enrich.Result{
		NormalizedText: lemma,
		Entries: []enrich.Entry{{
			Lemma:        lemma,
			PartOfSpeech: "verb",
			Senses: []enrich.Sense{{
				Definition:       "an English only filler",
				NativeDefinition: "",
			}},
		}},
	}}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	_, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "", nil)
	if !errors.Is(err, ErrNoSenses) {
		t.Fatalf("expected ErrNoSenses, got %v", err)
	}

	var wordCount int
	if err := pool.QueryRow(ctx, `
		select count(*) from words where normalized_text = $1`, lemma).Scan(&wordCount); err != nil {
		t.Fatal(err)
	}
	if wordCount != 0 {
		t.Fatalf("expected no empty word rows, got %d", wordCount)
	}
}

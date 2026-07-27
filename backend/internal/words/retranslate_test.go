package words

import (
	"context"
	"fmt"
	"testing"
	"time"

	"project-pn/internal/admin"
	"project-pn/internal/enrich"
	"project-pn/internal/learninglog"
)

func TestRetranslateWordRemapsAndPreservesReviewState(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	userID, _ := deckTestUser(t, pool)

	lemma := fmt.Sprintf("charge%d", time.Now().UnixNano())
	var wordID string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'verb')
		returning id::text
	`, lemma).Scan(&wordID); err != nil {
		t.Fatalf("insert word: %v", err)
	}

	var oldSenseID string
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, short_definition, meaning_order)
		values ($1::uuid, 'deliberately', 'deliberately', 1)
		returning id::text
	`, wordID).Scan(&oldSenseID); err != nil {
		t.Fatalf("insert old sense: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into sense_translations (word_sense_id, language_code, definition, short_definition)
		values ($1::uuid, 'ko', '고의로', '고의로')
	`, oldSenseID); err != nil {
		t.Fatalf("insert translation: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into examples (word_sense_id, sentence, source)
		values ($1::uuid, 'He did it deliberately.', 'test')
	`, oldSenseID); err != nil {
		t.Fatalf("insert example: %v", err)
	}

	deckID, err := New(pool, &stubEnricher{}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko").EnsureDefaultDeck(ctx, userID, "en")
	if err != nil {
		t.Fatalf("ensure deck: %v", err)
	}

	var uwsID string
	if err := pool.QueryRow(ctx, `
		insert into user_word_senses (user_id, word_sense_id, deck_id)
		values ($1::uuid, $2::uuid, $3::uuid)
		returning id::text
	`, userID, oldSenseID, deckID).Scan(&uwsID); err != nil {
		t.Fatalf("insert uws: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into review_states (user_word_sense_id, due_at, stability, difficulty, review_count)
		values ($1::uuid, now(), 1.0, 5.0, 3)
	`, uwsID); err != nil {
		t.Fatalf("insert review_states: %v", err)
	}

	stub := &stubEnricher{
		enrichResult: enrich.Result{
			NormalizedText: lemma,
			Entries: []enrich.Entry{{
				Lemma:        lemma,
				PartOfSpeech: "verb",
				Senses: []enrich.Sense{{
					Definition:            "intentionally; deliberately",
					ShortDefinition:       "deliberately",
					NativeDefinition:      "의도적으로",
					NativeShortDefinition: "의도적으로",
					Examples: []enrich.Example{{
						Sentence:    "She charged the phone overnight.",
						Translation: "그녀는 밤새 폰을 **충전**했다.",
					}},
				}},
			}},
		},
	}
	svc := New(pool, stub, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	if err := svc.RetranslateWord(ctx, wordID); err != nil {
		t.Fatal(err)
	}

	var newSenseID string
	var reviewCount int
	if err := pool.QueryRow(ctx, `
		select uws.word_sense_id::text, coalesce(rs.review_count, 0)
		from user_word_senses uws
		left join review_states rs on rs.user_word_sense_id = uws.id
		where uws.id = $1::uuid
	`, uwsID).Scan(&newSenseID, &reviewCount); err != nil {
		t.Fatalf("load remapped uws: %v", err)
	}
	if newSenseID == oldSenseID {
		t.Fatal("expected word_sense_id to change")
	}
	if reviewCount != 3 {
		t.Fatalf("review_count=%d want 3", reviewCount)
	}

	var oldExists bool
	if err := pool.QueryRow(ctx, `select exists(select 1 from word_senses where id = $1::uuid)`, oldSenseID).Scan(&oldExists); err != nil {
		t.Fatal(err)
	}
	if oldExists {
		t.Fatal("old sense should be deleted")
	}

	var exampleCount int
	if err := pool.QueryRow(ctx, `select count(*) from examples where word_sense_id = $1::uuid`, newSenseID).Scan(&exampleCount); err != nil {
		t.Fatal(err)
	}
	if exampleCount != 1 {
		t.Fatalf("example count=%d want 1", exampleCount)
	}
}

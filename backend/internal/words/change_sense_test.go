package words

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"project-pn/internal/admin"
	"project-pn/internal/learninglog"
)

func TestChangeLearningItemSensePreservesReviewCount(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	svc := New(pool, &stubEnricher{}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")
	userID, _ := deckTestUser(t, pool)

	lemma := fmt.Sprintf("chg%d", time.Now().UnixNano())
	var wordID, senseA, senseB string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'verb') returning id::text
	`, lemma).Scan(&wordID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, 'sense a', 1) returning id::text
	`, wordID).Scan(&senseA); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, 'sense b', 2) returning id::text
	`, wordID).Scan(&senseB); err != nil {
		t.Fatal(err)
	}
	for _, sid := range []string{senseA, senseB} {
		if _, err := pool.Exec(ctx, `
			insert into sense_translations (word_sense_id, language_code, definition)
			values ($1::uuid, 'ko', '번역')
		`, sid); err != nil {
			t.Fatal(err)
		}
	}

	item, err := svc.AddLearningItem(ctx, userID, senseA, "ko", "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		update review_states set review_count = 7 where user_word_sense_id = $1::uuid
	`, item.ID); err != nil {
		t.Fatal(err)
	}

	updated, err := svc.ChangeLearningItemSense(ctx, userID, item.ID, senseB, "ko", nil)
	if err != nil {
		t.Fatal(err)
	}
	if updated.ID != item.ID {
		t.Fatalf("id changed: %s -> %s", item.ID, updated.ID)
	}
	if updated.WordSenseID != senseB {
		t.Fatalf("sense=%s want %s", updated.WordSenseID, senseB)
	}

	var reviewCount int
	if err := pool.QueryRow(ctx, `
		select review_count from review_states where user_word_sense_id = $1::uuid
	`, item.ID).Scan(&reviewCount); err != nil {
		t.Fatal(err)
	}
	if reviewCount != 7 {
		t.Fatalf("review_count=%d want 7", reviewCount)
	}
}

func TestChangeLearningItemSenseConflict(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	svc := New(pool, &stubEnricher{}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")
	userID, _ := deckTestUser(t, pool)

	lemma := fmt.Sprintf("conf%d", time.Now().UnixNano())
	var wordID, senseA, senseB string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'verb') returning id::text
	`, lemma).Scan(&wordID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, 'sense a', 1) returning id::text
	`, wordID).Scan(&senseA); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, 'sense b', 2) returning id::text
	`, wordID).Scan(&senseB); err != nil {
		t.Fatal(err)
	}
	for _, sid := range []string{senseA, senseB} {
		if _, err := pool.Exec(ctx, `
			insert into sense_translations (word_sense_id, language_code, definition)
			values ($1::uuid, 'ko', '번역')
		`, sid); err != nil {
			t.Fatal(err)
		}
	}

	itemA, err := svc.AddLearningItem(ctx, userID, senseA, "ko", "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.AddLearningItem(ctx, userID, senseB, "ko", "", "", ""); err != nil {
		t.Fatal(err)
	}

	_, err = svc.ChangeLearningItemSense(ctx, userID, itemA.ID, senseB, "ko", nil)
	if !errors.Is(err, ErrSenseConflict) {
		t.Fatalf("expected ErrSenseConflict, got %v", err)
	}
}

func TestChangeLearningItemSenseRejectsCrossWord(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	svc := New(pool, &stubEnricher{}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")
	userID, _ := deckTestUser(t, pool)

	senseA := insertDeckFixtureWord(t, pool, fmt.Sprintf("crossa%d", time.Now().UnixNano()))
	senseB := insertDeckFixtureWord(t, pool, fmt.Sprintf("crossb%d", time.Now().UnixNano()))

	item, err := svc.AddLearningItem(ctx, userID, senseA, "en", "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.ChangeLearningItemSense(ctx, userID, item.ID, senseB, "en", nil)
	if !errors.Is(err, ErrSenseWrongWord) {
		t.Fatalf("expected ErrSenseWrongWord, got %v", err)
	}
}

func TestChangeMeaningClearsPersonalNoteByDefault(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	svc := New(pool, &stubEnricher{}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")
	userID, _ := deckTestUser(t, pool)

	lemma := fmt.Sprintf("clrnote%d", time.Now().UnixNano())
	var wordID, senseA, senseB string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'verb') returning id::text
	`, lemma).Scan(&wordID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, 'sense a', 1) returning id::text
	`, wordID).Scan(&senseA); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, 'sense b', 2) returning id::text
	`, wordID).Scan(&senseB); err != nil {
		t.Fatal(err)
	}
	for _, sid := range []string{senseA, senseB} {
		if _, err := pool.Exec(ctx, `
			insert into sense_translations (word_sense_id, language_code, definition)
			values ($1::uuid, 'ko', '번역')
		`, sid); err != nil {
			t.Fatal(err)
		}
	}

	item, err := svc.AddLearningItem(ctx, userID, senseA, "ko", "", "", "old wording")
	if err != nil {
		t.Fatal(err)
	}
	if item.PersonalNote == nil || *item.PersonalNote != "old wording" {
		t.Fatalf("setup note=%v", item.PersonalNote)
	}

	updated, err := svc.ChangeLearningItemSense(ctx, userID, item.ID, senseB, "ko", nil)
	if err != nil {
		t.Fatal(err)
	}
	if updated.WordSenseID != senseB {
		t.Fatalf("sense=%s want %s", updated.WordSenseID, senseB)
	}
	if updated.PersonalNote != nil {
		t.Fatalf("expected personal_note cleared, got %v", updated.PersonalNote)
	}
}

func TestChangeMeaningSetsPersonalNote(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	svc := New(pool, &stubEnricher{}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")
	userID, _ := deckTestUser(t, pool)

	lemma := fmt.Sprintf("setnote%d", time.Now().UnixNano())
	var wordID, senseA, senseB string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'verb') returning id::text
	`, lemma).Scan(&wordID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, 'sense a', 1) returning id::text
	`, wordID).Scan(&senseA); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, 'sense b', 2) returning id::text
	`, wordID).Scan(&senseB); err != nil {
		t.Fatal(err)
	}
	for _, sid := range []string{senseA, senseB} {
		if _, err := pool.Exec(ctx, `
			insert into sense_translations (word_sense_id, language_code, definition)
			values ($1::uuid, 'ko', '번역')
		`, sid); err != nil {
			t.Fatal(err)
		}
	}

	item, err := svc.AddLearningItem(ctx, userID, senseA, "ko", "", "", "old")
	if err != nil {
		t.Fatal(err)
	}
	note := "새 표현"
	updated, err := svc.ChangeLearningItemSense(ctx, userID, item.ID, senseB, "ko", &note)
	if err != nil {
		t.Fatal(err)
	}
	if updated.PersonalNote == nil || *updated.PersonalNote != note {
		t.Fatalf("personal_note=%v", updated.PersonalNote)
	}
}

func TestChangeMeaningNoteOnlySameSense(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	svc := New(pool, &stubEnricher{}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")
	userID, _ := deckTestUser(t, pool)

	lemma := fmt.Sprintf("noteonly%d", time.Now().UnixNano())
	var wordID, senseA string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'verb') returning id::text
	`, lemma).Scan(&wordID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, 'sense a', 1) returning id::text
	`, wordID).Scan(&senseA); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		insert into sense_translations (word_sense_id, language_code, definition)
		values ($1::uuid, 'ko', '번역')
	`, senseA); err != nil {
		t.Fatal(err)
	}

	item, err := svc.AddLearningItem(ctx, userID, senseA, "ko", "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	note := "mnemonic only"
	updated, err := svc.ChangeLearningItemSense(ctx, userID, item.ID, senseA, "ko", &note)
	if err != nil {
		t.Fatal(err)
	}
	if updated.WordSenseID != senseA {
		t.Fatalf("sense changed unexpectedly: %s", updated.WordSenseID)
	}
	if updated.PersonalNote == nil || *updated.PersonalNote != note {
		t.Fatalf("personal_note=%v", updated.PersonalNote)
	}
}

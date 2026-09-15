package words

import (
	"context"
	"fmt"
	"testing"
	"time"

	"project-pn/internal/admin"
	"project-pn/internal/learninglog"
)

func TestArchiveLearningItemsExcludesFromList(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	userID, _ := deckTestUser(t, pool)
	svc := New(pool, &stubEnricher{}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	lemma := fmt.Sprintf("archive%d", time.Now().UnixNano())
	var wordID, senseID string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'noun') returning id::text
	`, lemma).Scan(&wordID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, 'def', 1) returning id::text
	`, wordID).Scan(&senseID); err != nil {
		t.Fatal(err)
	}
	deckID, err := svc.EnsureDefaultDeck(ctx, userID, "en")
	if err != nil {
		t.Fatal(err)
	}

	var itemID string
	if err := pool.QueryRow(ctx, `
		insert into user_word_senses (user_id, word_sense_id, deck_id)
		values ($1::uuid, $2::uuid, $3::uuid)
		returning id::text
	`, userID, senseID, deckID).Scan(&itemID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		insert into review_states (user_word_sense_id) values ($1::uuid)
	`, itemID); err != nil {
		t.Fatal(err)
	}

	n, err := svc.ArchiveLearningItems(ctx, userID, []string{itemID})
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("archived=%d want 1", n)
	}

	page, err := svc.ListLearningItems(ctx, userID, ListLearningItemsParams{Limit: 50})
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range page.Items {
		if item.ID == itemID {
			t.Fatal("archived item still listed")
		}
	}

	n2, err := svc.ArchiveLearningItems(ctx, userID, []string{itemID})
	if err != nil {
		t.Fatal(err)
	}
	if n2 != 0 {
		t.Fatalf("second archive=%d want 0", n2)
	}
}

func TestArchiveLearningItemsNotFound(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	userID, _ := deckTestUser(t, pool)
	svc := New(pool, &stubEnricher{}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	_, err := svc.ArchiveLearningItems(ctx, userID, []string{"00000000-0000-0000-0000-000000000099"})
	if err != ErrLearningItemNotFound {
		t.Fatalf("err=%v want ErrLearningItemNotFound", err)
	}
}

func TestAddLearningItemUnarchivesOnConflict(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	userID, _ := deckTestUser(t, pool)
	svc := New(pool, &stubEnricher{}, admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	lemma := fmt.Sprintf("unarchive%d", time.Now().UnixNano())
	var wordID, senseID string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'noun') returning id::text
	`, lemma).Scan(&wordID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, 'def', 1) returning id::text
	`, wordID).Scan(&senseID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		insert into sense_translations (word_sense_id, language_code, definition)
		values ($1::uuid, 'ko', '테스트')
	`, senseID); err != nil {
		t.Fatal(err)
	}

	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "", "")
	if err != nil {
		t.Fatal(err)
	}

	if _, err := svc.ArchiveLearningItems(ctx, userID, []string{item.ID}); err != nil {
		t.Fatal(err)
	}

	restored, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if restored.ID != item.ID {
		t.Fatalf("id changed %s -> %s", item.ID, restored.ID)
	}

	var archivedAt *time.Time
	if err := pool.QueryRow(ctx, `select archived_at from user_word_senses where id=$1::uuid`, item.ID).Scan(&archivedAt); err != nil {
		t.Fatal(err)
	}
	if archivedAt != nil {
		t.Fatal("expected archived_at cleared after re-add")
	}
}

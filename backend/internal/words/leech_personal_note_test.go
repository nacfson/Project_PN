package words

import (
	"context"
	"fmt"
	"testing"
	"time"

	"project-pn/internal/admin"
	"project-pn/internal/learninglog"
)

func TestDefaultReviewSettingsUsesTagLeechAction(t *testing.T) {
	settings := DefaultReviewSettings("user-1")
	if settings.LeechAction != "tag" {
		t.Fatalf("LeechAction=%q want tag", settings.LeechAction)
	}
}

func TestSetPersonalNoteDoesNotTouchWordSenses(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	userID, _ := deckTestUser(t, pool)
	logDir := t.TempDir()
	logger, err := learninglog.NewLogger(logDir)
	if err != nil {
		t.Fatal(err)
	}
	svc := New(pool, &stubEnricher{}, admin.NoopLogger{}, logger, "", "en", "ko")

	lemma := fmt.Sprintf("note%d", time.Now().UnixNano())
	senseID := insertDeckFixtureWord(t, pool, lemma)
	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "")
	if err != nil {
		t.Fatal(err)
	}

	var senseCountBefore int
	if err := pool.QueryRow(ctx, `select count(*) from word_senses`).Scan(&senseCountBefore); err != nil {
		t.Fatal(err)
	}

	updated, err := svc.SetPersonalNote(ctx, userID, item.ID, "내가 쓴 뜻")
	if err != nil {
		t.Fatal(err)
	}
	if updated.PersonalNote == nil || *updated.PersonalNote != "내가 쓴 뜻" {
		t.Fatalf("personal_note=%v", updated.PersonalNote)
	}

	var senseCountAfter int
	if err := pool.QueryRow(ctx, `select count(*) from word_senses`).Scan(&senseCountAfter); err != nil {
		t.Fatal(err)
	}
	if senseCountAfter != senseCountBefore {
		t.Fatalf("word_senses grew %d -> %d", senseCountBefore, senseCountAfter)
	}

	due, err := svc.GetDueReviewItems(ctx, userID, "", "", "private", 50)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, d := range due {
		if d.UserWordSenseID == item.ID {
			found = true
			if d.PersonalNote == nil || *d.PersonalNote != "내가 쓴 뜻" {
				t.Fatalf("due personal_note=%v", d.PersonalNote)
			}
		}
	}
	if !found {
		t.Fatal("item missing from due after personal note")
	}
}

func TestLeechTagKeepsCardInDue(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	userID, _ := deckTestUser(t, pool)
	svc := deckTestService(t, pool)

	if _, err := pool.Exec(ctx, `
		insert into review_settings (user_id, leech_threshold, leech_action, fuzz_enabled)
		values ($1::uuid, 1, 'tag', false)
		on conflict (user_id) do update set leech_threshold = 1, leech_action = 'tag', fuzz_enabled = false
	`, userID); err != nil {
		t.Fatal(err)
	}

	senseID := insertDeckFixtureWord(t, pool, fmt.Sprintf("leech%d", time.Now().UnixNano()))
	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "")
	if err != nil {
		t.Fatal(err)
	}

	// Graduate to Review first, then lapse to trigger leech.
	if _, err := svc.RecordBatchReviewAttempts(ctx, userID, []ReviewAttemptParams{{
		UserWordSenseID: item.ID,
		ActivityType:    "word_to_meaning",
		IsCorrect:       true,
		RatingScore:     2,
	}}); err != nil {
		t.Fatal(err)
	}
	res, err := svc.RecordBatchReviewAttempts(ctx, userID, []ReviewAttemptParams{{
		UserWordSenseID: item.ID,
		ActivityType:    "word_to_meaning",
		IsCorrect:       false,
		RatingScore:     0,
	}})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.UpdatedItems) != 1 || !res.UpdatedItems[0].Leech || res.UpdatedItems[0].Suspended {
		t.Fatalf("updated=%+v want leech without suspend", res.UpdatedItems)
	}

	var archivedAt *time.Time
	var suspended bool
	if err := pool.QueryRow(ctx, `
		select uws.archived_at, rs.is_suspended
		from user_word_senses uws
		join review_states rs on rs.user_word_sense_id = uws.id
		where uws.id = $1::uuid
	`, item.ID).Scan(&archivedAt, &suspended); err != nil {
		t.Fatal(err)
	}
	if archivedAt != nil || suspended {
		t.Fatalf("archived=%v suspended=%v", archivedAt, suspended)
	}

	due, err := svc.GetDueReviewItems(ctx, userID, "", "", "private", 50)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, d := range due {
		if d.UserWordSenseID == item.ID {
			found = true
			if !d.IsLeech {
				t.Fatal("expected is_leech on due item")
			}
		}
	}
	if !found {
		t.Fatal("leech-tagged card missing from due")
	}
}

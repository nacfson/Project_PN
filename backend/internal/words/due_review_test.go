package words

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestDueReviewRecoversFailedCardsAfterInterruptedSession(t *testing.T) {
	pool := deckTestPool(t)
	svc := deckTestService(t, pool)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	type card struct {
		item   LearningItem
		failed bool
	}
	cards := make([]card, 5)
	for i := range cards {
		lemma := fmt.Sprintf("retry%d-%d", i, time.Now().UnixNano())
		senseID := insertDeckFixtureWord(t, pool, lemma)
		item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "", "")
		if err != nil {
			t.Fatalf("add item %d: %v", i, err)
		}
		cards[i] = card{item: item, failed: i < 2}
	}

	attempts := make([]ReviewAttemptParams, 0, len(cards))
	for _, c := range cards {
		score := 2.0
		if c.failed {
			score = 0.0
		}
		attempts = append(attempts, ReviewAttemptParams{
			UserWordSenseID: c.item.ID,
			ActivityType:    "word_to_meaning",
			IsCorrect:       !c.failed,
			RatingScore:     score,
		})
	}
	if _, err := svc.RecordBatchReviewAttempts(ctx, userID, attempts); err != nil {
		t.Fatalf("record interrupted session: %v", err)
	}

	due, err := svc.GetDueReviewItems(ctx, userID, "", "", "private", 50)
	if err != nil {
		t.Fatalf("get due after interrupt: %v", err)
	}

	got := map[string]bool{}
	for _, item := range due {
		got[item.UserWordSenseID] = true
	}

	for _, c := range cards {
		present := got[c.item.ID]
		if c.failed && !present {
			t.Errorf("failed card %s missing from due list after refresh", c.item.ID)
		}
		if !c.failed && present {
			t.Errorf("successful card %s should not be due after refresh", c.item.ID)
		}
	}
	if len(due) != 2 {
		t.Errorf("expected 2 due retry cards, got %d", len(due))
	}
}

func TestDueReviewRecoversRelearningCardBeforeStepElapses(t *testing.T) {
	pool := deckTestPool(t)
	svc := deckTestService(t, pool)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	senseID := insertDeckFixtureWord(t, pool, fmt.Sprintf("relearn-%d", time.Now().UnixNano()))
	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "", "")
	if err != nil {
		t.Fatalf("add item: %v", err)
	}

	if _, err := pool.Exec(ctx, `
		update review_states
		set fsrs_state = 'Review',
		    review_count = 4,
		    stability = 8,
		    difficulty = 5,
		    scheduled_days = 3,
		    remaining_steps = 0,
		    due_at = now() - interval '1 hour'
		where user_word_sense_id = $1::uuid`,
		item.ID,
	); err != nil {
		t.Fatalf("promote to review: %v", err)
	}

	if _, err := svc.RecordBatchReviewAttempts(ctx, userID, []ReviewAttemptParams{{
		UserWordSenseID: item.ID,
		ActivityType:    "word_to_meaning",
		IsCorrect:       false,
		RatingScore:     0,
	}}); err != nil {
		t.Fatalf("fail review card: %v", err)
	}

	var fsrsState string
	var dueAt time.Time
	if err := pool.QueryRow(ctx, `
		select fsrs_state, due_at
		from review_states
		where user_word_sense_id = $1::uuid`,
		item.ID,
	).Scan(&fsrsState, &dueAt); err != nil {
		t.Fatalf("load review state: %v", err)
	}
	if fsrsState != "Relearning" {
		t.Fatalf("expected Relearning after lapse, got %q", fsrsState)
	}
	if !dueAt.After(time.Now().UTC()) {
		t.Fatalf("expected relearning due_at in the future, got %s", dueAt)
	}

	due, err := svc.GetDueReviewItems(ctx, userID, "", "", "private", 50)
	if err != nil {
		t.Fatalf("get due: %v", err)
	}
	found := false
	for _, d := range due {
		if d.UserWordSenseID == item.ID {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("lapsed relearning card missing from due list before step elapsed")
	}
}

func TestDueReviewRecoversLearningCardsWhenDailyQuotaExhausted(t *testing.T) {
	pool := deckTestPool(t)
	svc := deckTestService(t, pool)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	senseID := insertDeckFixtureWord(t, pool, fmt.Sprintf("quota-%d", time.Now().UnixNano()))
	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "", "")
	if err != nil {
		t.Fatalf("add item: %v", err)
	}

	if _, err := svc.RecordBatchReviewAttempts(ctx, userID, []ReviewAttemptParams{{
		UserWordSenseID: item.ID,
		ActivityType:    "word_to_meaning",
		IsCorrect:       false,
		RatingScore:     0,
	}}); err != nil {
		t.Fatalf("fail new card: %v", err)
	}

	if _, err := pool.Exec(ctx, `
		update review_settings
		set new_cards_per_day = 0, reviews_per_day = 0
		where user_id = $1::uuid`,
		userID,
	); err != nil {
		t.Fatalf("zero daily quotas: %v", err)
	}

	due, err := svc.GetDueReviewItems(ctx, userID, "", "", "private", 50)
	if err != nil {
		t.Fatalf("get due: %v", err)
	}
	found := false
	for _, d := range due {
		if d.UserWordSenseID == item.ID {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("learning retry card missing from due list when daily quotas are exhausted")
	}
}

func TestGetDueReviewItemsReturnsPersonalNote(t *testing.T) {
	pool := deckTestPool(t)
	svc := deckTestService(t, pool)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	senseID := insertDeckFixtureWord(t, pool, fmt.Sprintf("duenote-%d", time.Now().UnixNano()))
	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "", "내 뜻")
	if err != nil {
		t.Fatalf("add item: %v", err)
	}

	due, err := svc.GetDueReviewItems(ctx, userID, "", "", "private", 50)
	if err != nil {
		t.Fatalf("get due: %v", err)
	}
	found := false
	for _, d := range due {
		if d.UserWordSenseID == item.ID {
			found = true
			if d.PersonalNote == nil || *d.PersonalNote != "내 뜻" {
				t.Fatalf("due personal_note=%v", d.PersonalNote)
			}
		}
	}
	if !found {
		t.Fatal("item missing from due list")
	}
}

package learninglog

import (
	"strings"
	"testing"
	"time"
)

func TestRowReviewAttemptedOmitsNullResponseTime(t *testing.T) {
	ts := time.Date(2026, 7, 26, 9, 15, 44, 0, time.UTC)
	row := RowReviewAttempted(ts, ReviewAttemptedParams{
		UserID:        "u1",
		UWSID:         "w1",
		WordSenseID:   "s1",
		Lemma:         "charge",
		ActivityType:  "cloze",
		Rating:        "again",
		IsCorrect:     false,
		LearningStage: "learning",
		FSRSState:     "Learning",
		Difficulty:    "7.2",
		Stability:     "1.4",
		Leech:         false,
	})
	if strings.Contains(row, "response_time_ms") {
		t.Fatalf("should omit null response_time_ms: %q", row)
	}
	if !strings.Contains(row, "rating=again") {
		t.Fatalf("expected rating=again in %q", row)
	}
}

func TestRowLearningItemAddedContainsEvent(t *testing.T) {
	ts := time.Date(2026, 7, 26, 9, 12, 3, 0, time.UTC)
	row := RowLearningItemAdded(ts, LearningItemAddedParams{
		UserID:              "u1",
		UWSID:               "uw1",
		WordSenseID:         "s1",
		Lemma:               "charge",
		POS:                 "verb",
		Definition:          "to pay",
		LocalizedDefinition: "지불하다",
		LangPair:            "en-ko",
		SourceContext:       "",
	})
	if !strings.Contains(row, "event=learning_item_added") {
		t.Fatalf("missing event: %q", row)
	}
}

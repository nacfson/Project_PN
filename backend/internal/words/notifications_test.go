package words

import (
	"testing"
	"time"
)

func TestPreferredReviewHourUTC(t *testing.T) {
	if got := PreferredReviewHourUTC(nil); got != 9 {
		t.Fatalf("empty hours want 9, got %d", got)
	}
	if got := PreferredReviewHourUTC([]int{8, 20, 14}); got != 14 {
		t.Fatalf("median want 14, got %d", got)
	}
}

func TestWithinPreferredSendWindow(t *testing.T) {
	preferred := 14
	now := time.Date(2026, 6, 21, 14, 30, 0, 0, time.UTC)
	if !WithinPreferredSendWindow(now, preferred) {
		t.Fatal("expected within window at preferred hour")
	}
	now = time.Date(2026, 6, 21, 10, 0, 0, 0, time.UTC)
	if WithinPreferredSendWindow(now, preferred) {
		t.Fatal("expected outside window")
	}
}

func TestRetrievability(t *testing.T) {
	if Retrievability(0, 10) <= 0 {
		t.Fatal("expected positive retrievability at zero elapsed")
	}
	if Retrievability(30, 5) >= Retrievability(1, 5) {
		t.Fatal("longer elapsed should reduce retrievability")
	}
	if Retrievability(1, 0) != 0 {
		t.Fatal("zero stability should yield zero retrievability")
	}
}

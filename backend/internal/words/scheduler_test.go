package words

import (
	"testing"
	"time"
)

func TestClassifyScoreToRating(t *testing.T) {
	tests := []struct {
		name  string
		score float64
		want  string
	}{
		{name: "again lower band", score: 0, want: "again"},
		{name: "hard starts at threshold", score: 0.75, want: "hard"},
		{name: "good starts at threshold", score: 1.5, want: "good"},
		{name: "easy starts at threshold", score: 2.25, want: "easy"},
		{name: "max easy", score: 3, want: "easy"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ClassifyScoreToRating(tt.score); got != tt.want {
				t.Fatalf("ClassifyScoreToRating(%v) = %q, want %q", tt.score, got, tt.want)
			}
		})
	}
}

func TestNewCardAgainEntersLearning(t *testing.T) {
	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	cfg := DefaultSchedulerConfig()
	cfg.FuzzEnabled = false

	next, rating, dueAt := CalculateNextFSRSState(FSRSState{State: "New"}, 0.1, nil, now, cfg)

	if rating != "again" {
		t.Fatalf("rating = %q, want again", rating)
	}
	if next.State != "Learning" {
		t.Fatalf("state = %q, want Learning", next.State)
	}
	if next.RemainingSteps != 1 { // len(LearningSteps) - 1 = 2 - 1 = 1
		t.Fatalf("remaining_steps = %d, want 1", next.RemainingSteps)
	}
	// Due in ~1 minute (learning_steps[0] = 1 min).
	expectedDue := now.Add(1 * time.Minute)
	if !dueAt.Equal(expectedDue) {
		t.Fatalf("dueAt = %s, want %s (1 minute)", dueAt, expectedDue)
	}
}

func TestNewCardGoodGraduatesToReview(t *testing.T) {
	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	cfg := DefaultSchedulerConfig()
	cfg.FuzzEnabled = false

	next, rating, _ := CalculateNextFSRSState(FSRSState{State: "New"}, 2.0, nil, now, cfg)

	if rating != "good" {
		t.Fatalf("rating = %q, want good", rating)
	}
	if next.State != "Review" {
		t.Fatalf("state = %q, want Review", next.State)
	}
	if next.RemainingSteps != 0 {
		t.Fatalf("remaining_steps = %d, want 0 (graduated)", next.RemainingSteps)
	}
	if next.Stability <= 0 {
		t.Fatalf("stability should be positive, got %f", next.Stability)
	}
	if next.Difficulty <= 0 {
		t.Fatalf("difficulty should be positive, got %f", next.Difficulty)
	}
}

func TestLearningCardAdvancesStep(t *testing.T) {
	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	cfg := DefaultSchedulerConfig()
	cfg.FuzzEnabled = false

	// A learning card with 1 remaining step (second step).
	curr := FSRSState{
		State:          "Learning",
		Stability:      1.0,
		Difficulty:     5.0,
		RemainingSteps: 1,
		ReviewCount:    1,
	}

	next, rating, dueAt := CalculateNextFSRSState(curr, 2.0, nil, now, cfg)

	if rating != "good" {
		t.Fatalf("rating = %q, want good", rating)
	}
	// After advancing past the last step, should graduate to Review.
	if next.State != "Review" {
		t.Fatalf("state = %q, want Review (graduated)", next.State)
	}
	if next.RemainingSteps != 0 {
		t.Fatalf("remaining_steps = %d, want 0 (graduated)", next.RemainingSteps)
	}
	// Should be scheduled at day-level, not minutes.
	if dueAt.Sub(now) < 1*time.Hour {
		t.Fatalf("dueAt should be days away, got %v", dueAt.Sub(now))
	}
}

func TestLearningCardAgainResetsToFirstStep(t *testing.T) {
	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	cfg := DefaultSchedulerConfig()
	cfg.FuzzEnabled = false

	curr := FSRSState{
		State:          "Learning",
		Stability:      1.0,
		Difficulty:     5.0,
		RemainingSteps: 1, // On second step
		ReviewCount:    1,
	}

	next, rating, dueAt := CalculateNextFSRSState(curr, 0.1, nil, now, cfg)

	if rating != "again" {
		t.Fatalf("rating = %q, want again", rating)
	}
	if next.State != "Learning" {
		t.Fatalf("state = %q, want Learning", next.State)
	}
	if next.RemainingSteps != 1 { // Reset to len(steps) - 1
		t.Fatalf("remaining_steps = %d, want 1 (reset)", next.RemainingSteps)
	}
	// Should be scheduled at first step (1 minute).
	expectedDue := now.Add(1 * time.Minute)
	if !dueAt.Equal(expectedDue) {
		t.Fatalf("dueAt = %s, want %s (1 minute)", dueAt, expectedDue)
	}
}

func TestReviewCardAgainEntersRelearning(t *testing.T) {
	lastReviewedAt := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)
	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	cfg := DefaultSchedulerConfig()
	cfg.FuzzEnabled = false

	curr := FSRSState{
		State:          "Review",
		Stability:      4,
		Difficulty:     5,
		ScheduledDays:  4,
		ReviewCount:    3,
		LapseCount:     1,
		LastReviewedAt: &lastReviewedAt,
	}

	next, rating, dueAt := CalculateNextFSRSState(curr, 0.1, nil, now, cfg)

	if rating != "again" {
		t.Fatalf("rating = %q, want again", rating)
	}
	if next.State != "Relearning" {
		t.Fatalf("state = %q, want Relearning", next.State)
	}
	if next.LapseCount != 2 {
		t.Fatalf("lapse count = %d, want 2", next.LapseCount)
	}
	if next.ReviewCount != 4 {
		t.Fatalf("review count = %d, want 4", next.ReviewCount)
	}
	// Should be scheduled in minutes (relearning_steps[0] = 10 min), not +1 day.
	expectedDue := now.Add(10 * time.Minute)
	if !dueAt.Equal(expectedDue) {
		t.Fatalf("dueAt = %s, want %s (10 minutes)", dueAt, expectedDue)
	}
}

func TestRelearningCardGraduatesToReview(t *testing.T) {
	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	cfg := DefaultSchedulerConfig()
	cfg.FuzzEnabled = false

	curr := FSRSState{
		State:          "Relearning",
		Stability:      2.0,
		Difficulty:     6.0,
		RemainingSteps: 0, // Last step
		ReviewCount:    4,
		LapseCount:     2,
		LastReviewedAt: &now,
	}

	next, rating, dueAt := CalculateNextFSRSState(curr, 2.0, nil, now, cfg)

	if rating != "good" {
		t.Fatalf("rating = %q, want good", rating)
	}
	if next.State != "Review" {
		t.Fatalf("state = %q, want Review (graduated from relearning)", next.State)
	}
	// Should be day-level scheduling.
	if dueAt.Sub(now) < 1*time.Hour {
		t.Fatalf("dueAt should be days away, got %v", dueAt.Sub(now))
	}
}

func TestReviewCardGoodDayLevel(t *testing.T) {
	lastReviewedAt := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)
	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	cfg := DefaultSchedulerConfig()
	cfg.FuzzEnabled = false

	curr := FSRSState{
		State:          "Review",
		Stability:      4,
		Difficulty:     5,
		ReviewCount:    3,
		LapseCount:     0,
		LastReviewedAt: &lastReviewedAt,
	}

	next, rating, dueAt := CalculateNextFSRSState(curr, 2.0, nil, now, cfg)

	if rating != "good" {
		t.Fatalf("rating = %q, want good", rating)
	}
	if next.State != "Review" {
		t.Fatalf("state = %q, want Review", next.State)
	}
	// Should be day-level, not minutes.
	if dueAt.Sub(now) < 24*time.Hour {
		t.Fatalf("dueAt should be at least 1 day away, got %v", dueAt.Sub(now))
	}
}

func TestFuzzDisabledProducesExactIntervals(t *testing.T) {
	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	cfg := DefaultSchedulerConfig()
	cfg.FuzzEnabled = false

	curr := FSRSState{
		State:          "Review",
		Stability:      10,
		Difficulty:     5,
		ReviewCount:    5,
		LapseCount:     0,
		LastReviewedAt: &now,
	}

	// Run twice and verify identical results (no randomness).
	_, _, dueAt1 := CalculateNextFSRSState(curr, 2.0, nil, now, cfg)
	_, _, dueAt2 := CalculateNextFSRSState(curr, 2.0, nil, now, cfg)

	if !dueAt1.Equal(dueAt2) {
		t.Fatalf("fuzz disabled should produce identical intervals: %s vs %s", dueAt1, dueAt2)
	}
}

func TestFuzzIntervalSmallDaysUnchanged(t *testing.T) {
	// Days < 2 should not be fuzzed.
	for i := 0; i < 100; i++ {
		result := fuzzInterval(1)
		if result != 1 {
			t.Fatalf("fuzzInterval(1) = %d, want 1 (no fuzz for small intervals)", result)
		}
	}
}

func TestFuzzIntervalWithinRange(t *testing.T) {
	days := 100
	minExpected := int(float64(days) * 0.75) // -25%
	maxExpected := int(float64(days) * 1.25) // +25%

	for i := 0; i < 100; i++ {
		result := fuzzInterval(days)
		if result < minExpected || result > maxExpected {
			t.Fatalf("fuzzInterval(%d) = %d, want between %d and %d", days, result, minExpected, maxExpected)
		}
	}
}

func TestDesiredRetentionAffectsScheduledDays(t *testing.T) {
	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)

	curr := FSRSState{
		State:          "Review",
		Stability:      10,
		Difficulty:     5,
		ReviewCount:    5,
		LapseCount:     0,
		LastReviewedAt: &now,
	}

	cfgLow := DefaultSchedulerConfig()
	cfgLow.FuzzEnabled = false
	cfgLow.DesiredRetention = 0.85

	cfgHigh := DefaultSchedulerConfig()
	cfgHigh.FuzzEnabled = false
	cfgHigh.DesiredRetention = 0.95

	_, _, dueAtLow := CalculateNextFSRSState(curr, 2.0, nil, now, cfgLow)
	_, _, dueAtHigh := CalculateNextFSRSState(curr, 2.0, nil, now, cfgHigh)

	// Higher desired retention → shorter interval (review more frequently
	// to maintain higher retention). Lower desired retention → longer interval.
	daysLow := dueAtLow.Sub(now).Hours() / 24
	daysHigh := dueAtHigh.Sub(now).Hours() / 24

	if daysLow <= daysHigh {
		t.Fatalf("lower desired retention should produce longer interval: low=%f days, high=%f days", daysLow, daysHigh)
	}
}

func TestSchedulerConfigFromSettings(t *testing.T) {
	settings := DefaultReviewSettings("user-1")
	cfg := SchedulerConfigFromSettings(settings)

	if cfg.DesiredRetention != 0.90 {
		t.Fatalf("desired retention = %f, want 0.90", cfg.DesiredRetention)
	}
	if !cfg.FuzzEnabled {
		t.Fatal("fuzz should be enabled by default")
	}
	if len(cfg.LearningSteps) != 2 {
		t.Fatalf("learning steps length = %d, want 2", len(cfg.LearningSteps))
	}
	if len(cfg.RelearningSteps) != 1 {
		t.Fatalf("relearning steps length = %d, want 1", len(cfg.RelearningSteps))
	}
	if len(cfg.Weights) != 19 {
		t.Fatalf("weights length = %d, want 19", len(cfg.Weights))
	}
}

func TestSchedulerConfigFromSettingsFallsBackOnInvalid(t *testing.T) {
	settings := ReviewSettings{
		UserID:           "user-1",
		LearningSteps:    nil,
		RelearningSteps:  nil,
		DesiredRetention: 0,
		FSRSWeights:      []float64{1, 2, 3}, // Wrong length
	}
	cfg := SchedulerConfigFromSettings(settings)

	if len(cfg.LearningSteps) != 2 {
		t.Fatalf("learning steps should fall back to default, got %d", len(cfg.LearningSteps))
	}
	if cfg.DesiredRetention != 0.90 {
		t.Fatalf("desired retention should fall back to 0.90, got %f", cfg.DesiredRetention)
	}
	if len(cfg.Weights) != 19 {
		t.Fatalf("weights should fall back to 19 defaults, got %d", len(cfg.Weights))
	}
}

func TestRecallStabilityModifierScorePosition(t *testing.T) {
	lowGood := recallStabilityModifier(1.5, "good", nil)
	highGood := recallStabilityModifier(2.2, "good", nil)

	if highGood <= lowGood {
		t.Fatalf("higher good score should increase modifier: low=%f high=%f", lowGood, highGood)
	}
	if lowGood < recallModifierMin || highGood > recallModifierMax {
		t.Fatalf("modifier out of bounds: low=%f high=%f", lowGood, highGood)
	}
}

func TestRecallStabilityModifierLatency(t *testing.T) {
	fastMs := 500
	slowMs := 12000
	fast := recallStabilityModifier(2.0, "good", &fastMs)
	slow := recallStabilityModifier(2.0, "good", &slowMs)
	none := recallStabilityModifier(2.0, "good", nil)

	if fast <= slow {
		t.Fatalf("fast response should increase modifier: fast=%f slow=%f", fast, slow)
	}
	if none < recallModifierMin || none > recallModifierMax {
		t.Fatalf("nil latency modifier out of bounds: %f", none)
	}
}

func TestReviewStabilityAffectedByLatency(t *testing.T) {
	lastReviewedAt := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)
	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	cfg := DefaultSchedulerConfig()
	cfg.FuzzEnabled = false

	curr := FSRSState{
		State:          "Review",
		Stability:      4,
		Difficulty:     5,
		ReviewCount:    3,
		LapseCount:     0,
		LastReviewedAt: &lastReviewedAt,
	}

	fastMs := 500
	slowMs := 12000
	nextFast, _, _ := CalculateNextFSRSState(curr, 2.0, &fastMs, now, cfg)
	nextSlow, _, _ := CalculateNextFSRSState(curr, 2.0, &slowMs, now, cfg)

	if nextFast.Stability <= nextSlow.Stability {
		t.Fatalf("fast response should yield higher stability: fast=%f slow=%f", nextFast.Stability, nextSlow.Stability)
	}
}

func TestReviewStabilityAffectedBySubBucketScore(t *testing.T) {
	lastReviewedAt := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)
	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	cfg := DefaultSchedulerConfig()
	cfg.FuzzEnabled = false

	curr := FSRSState{
		State:          "Review",
		Stability:      4,
		Difficulty:     5,
		ReviewCount:    3,
		LapseCount:     0,
		LastReviewedAt: &lastReviewedAt,
	}

	nextLow, _, _ := CalculateNextFSRSState(curr, 1.55, nil, now, cfg)
	nextHigh, _, _ := CalculateNextFSRSState(curr, 2.2, nil, now, cfg)

	if nextHigh.Stability <= nextLow.Stability {
		t.Fatalf("higher good score should yield higher stability: low=%f high=%f", nextLow.Stability, nextHigh.Stability)
	}
}

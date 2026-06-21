package words

import (
	"testing"
	"time"
)

func TestApplyReviewToStreak(t *testing.T) {
	today := time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC)
	yesterday := today.AddDate(0, 0, -1)
	twoDaysAgo := today.AddDate(0, 0, -2)

	t.Run("first review starts streak", func(t *testing.T) {
		streak := UserStreak{StreakFreezeTokens: 1}
		if !applyReviewToStreak(&streak, today) {
			t.Fatal("expected streak change")
		}
		if streak.CurrentStreakDays != 1 || streak.LongestStreakDays != 1 {
			t.Fatalf("got current=%d longest=%d", streak.CurrentStreakDays, streak.LongestStreakDays)
		}
	})

	t.Run("consecutive day increments", func(t *testing.T) {
		streak := UserStreak{
			CurrentStreakDays:  3,
			LongestStreakDays:  3,
			LastReviewDate:     &yesterday,
			StreakFreezeTokens: 1,
		}
		applyReviewToStreak(&streak, today)
		if streak.CurrentStreakDays != 4 || streak.LongestStreakDays != 4 {
			t.Fatalf("got current=%d longest=%d", streak.CurrentStreakDays, streak.LongestStreakDays)
		}
	})

	t.Run("missed day consumes freeze", func(t *testing.T) {
		streak := UserStreak{
			CurrentStreakDays:  5,
			LongestStreakDays:  5,
			LastReviewDate:     &twoDaysAgo,
			StreakFreezeTokens: 1,
		}
		applyReviewToStreak(&streak, today)
		if streak.CurrentStreakDays != 6 || streak.StreakFreezeTokens != 0 {
			t.Fatalf("got current=%d tokens=%d", streak.CurrentStreakDays, streak.StreakFreezeTokens)
		}
	})

	t.Run("long gap resets streak", func(t *testing.T) {
		last := today.AddDate(0, 0, -5)
		streak := UserStreak{
			CurrentStreakDays:  10,
			LongestStreakDays:  10,
			LastReviewDate:     &last,
			StreakFreezeTokens: 0,
		}
		applyReviewToStreak(&streak, today)
		if streak.CurrentStreakDays != 1 {
			t.Fatalf("got current=%d", streak.CurrentStreakDays)
		}
	})
}

func TestApplyStreakFreeze(t *testing.T) {
	today := time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC)
	twoDaysAgo := today.AddDate(0, 0, -2)

	streak := UserStreak{
		CurrentStreakDays:  4,
		LongestStreakDays:  4,
		LastReviewDate:     &twoDaysAgo,
		StreakFreezeTokens: 1,
	}
	if err := applyStreakFreeze(&streak, today); err != nil {
		t.Fatalf("applyStreakFreeze() error = %v", err)
	}
	if streak.StreakFreezeTokens != 0 {
		t.Fatalf("tokens = %d", streak.StreakFreezeTokens)
	}
	if streak.LastReviewDate == nil || !streak.LastReviewDate.Equal(today.AddDate(0, 0, -1)) {
		t.Fatalf("last review date = %v", streak.LastReviewDate)
	}
}

func TestStreakAtRisk(t *testing.T) {
	today := time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC)
	yesterday := today.AddDate(0, 0, -1)

	streak := UserStreak{
		CurrentStreakDays: 3,
		LastReviewDate:    &yesterday,
	}
	if !streakAtRisk(streak, today, 5) {
		t.Fatal("expected streak at risk when due cards remain")
	}
	if streakAtRisk(streak, today, 0) {
		t.Fatal("expected no risk when due queue is clear")
	}
}

func TestReconcileMissedDays(t *testing.T) {
	today := time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC)
	old := today.AddDate(0, 0, -4)

	streak := UserStreak{
		CurrentStreakDays: 7,
		LastReviewDate:    &old,
	}
	if !streak.reconcileMissedDays(today) || streak.CurrentStreakDays != 0 {
		t.Fatalf("expected streak reset, got %d", streak.CurrentStreakDays)
	}
}

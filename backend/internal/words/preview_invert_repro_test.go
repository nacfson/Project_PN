package words

import (
	"fmt"
	"testing"
	"time"
)

// TestReproHardCanExceedEasyWithFuzz exercises PreviewIntervals across card
// states with fuzz enabled. It prints Hard vs Easy inversion rates and is the
// concrete reproduction for the contradictory preview-interval UI bug.
//
//	cd backend && GOTOOLCHAIN=go1.26.0 go test -v -count=1 -run TestReproHardCanExceedEasyWithFuzz ./internal/words/
func TestReproHardCanExceedEasyWithFuzz(t *testing.T) {
	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	cfg := DefaultSchedulerConfig()
	cfg.FuzzEnabled = true
	w := cfg.Weights

	cases := []struct {
		name string
		curr FSRSState
	}{
		{
			// Stability large enough that scheduledDays >= 4 so ±25% fuzz applies.
			name: "Learning graduating last step (fuzzable)",
			curr: FSRSState{State: "Learning", Stability: 20.0, Difficulty: 5.0, RemainingSteps: 0, ReviewCount: 2},
		},
		{
			name: "Learning graduating last step (small, no fuzz)",
			curr: FSRSState{State: "Learning", Stability: 2.5, Difficulty: 5.0, RemainingSteps: 0, ReviewCount: 2},
		},
		{
			name: "Review mid stability",
			curr: FSRSState{
				State: "Review", Stability: 8.0, Difficulty: 5.0, ScheduledDays: 7, ReviewCount: 5,
				LastReviewedAt: ptrTime(now.Add(-7 * 24 * time.Hour)),
			},
		},
		{
			// Early review / low stability: Hard/Good/Easy base days closer; fuzz may invert.
			name: "Review low stability close intervals",
			curr: FSRSState{
				State: "Review", Stability: 2.0, Difficulty: 7.0, ScheduledDays: 2, ReviewCount: 2,
				LastReviewedAt: ptrTime(now.Add(-2 * 24 * time.Hour)),
			},
		},
		{
			name: "New card",
			curr: FSRSState{State: "New"},
		},
		{
			name: "Relearning graduating (fuzzable)",
			curr: FSRSState{
				State: "Relearning", Stability: 40.0, Difficulty: 6.0, RemainingSteps: 0, ReviewCount: 4, LapseCount: 1,
				LastReviewedAt: ptrTime(now.Add(-10 * 24 * time.Hour)),
			},
		},
	}

	for _, tc := range cases {
		cfgNoFuzz := cfg
		cfgNoFuzz.FuzzEnabled = false
		p0 := PreviewIntervals(tc.curr, now, cfgNoFuzz)
		t.Logf("%s: no-fuzz baseline again=%s hard=%s good=%s easy=%s", tc.name, p0.Again, p0.Hard, p0.Good, p0.Easy)

		if tc.curr.normalizedState() == "Learning" || tc.curr.normalizedState() == "Relearning" {
			stab := clampStability(tc.curr.Stability)
			if tc.curr.normalizedState() == "Relearning" {
				elapsed := elapsedDays(tc.curr.LastReviewedAt, now)
				r := forgettingCurve(w, float64(elapsed), tc.curr.Stability)
				stab = clampStability(nextForgetStability(w, tc.curr.Difficulty, tc.curr.Stability, r))
			}
			h := scheduledDays(w, stab, "hard", cfg.DesiredRetention, false)
			g := scheduledDays(w, stab, "good", cfg.DesiredRetention, false)
			e := scheduledDays(w, stab, "easy", cfg.DesiredRetention, false)
			t.Logf("%s: pre-fuzz scheduledDays hard=%d good=%d easy=%d equal=%v stability=%.4f",
				tc.name, h, g, e, h == g && g == e, stab)
		}

		if tc.curr.normalizedState() == "Review" {
			for _, rating := range []string{"hard", "good", "easy"} {
				score := map[string]float64{"hard": 1, "good": 2, "easy": 3}[rating]
				next, _, _ := CalculateNextFSRSState(tc.curr, score, nil, now, cfgNoFuzz)
				t.Logf("%s: no-fuzz nextStability rating=%s stability=%.4f scheduledDays=%d",
					tc.name, rating, next.Stability, next.ScheduledDays)
			}
		}

		inversions := 0
		hardGtGood := 0
		goodGtEasy := 0
		var example string
		const trials = 300
		for i := 0; i < trials; i++ {
			p := PreviewIntervals(tc.curr, now, cfg)
			h := intervalDaysApprox(p.Hard)
			g := intervalDaysApprox(p.Good)
			e := intervalDaysApprox(p.Easy)
			if h > e {
				inversions++
				if example == "" {
					example = fmt.Sprintf("again=%s hard=%s good=%s easy=%s", p.Again, p.Hard, p.Good, p.Easy)
					// #region agent log
					agentDebugLog("A", "preview_invert_repro_test.go:inversion", "captured Hard>Easy preview inversion", map[string]any{
						"case": tc.name, "again": p.Again, "hard": p.Hard, "good": p.Good, "easy": p.Easy,
						"trial": i,
					})
					// #endregion
				}
			}
			if h > g {
				hardGtGood++
			}
			if g > e {
				goodGtEasy++
			}
		}
		t.Logf("%s: hard>easy=%d/%d hard>good=%d/%d good>easy=%d/%d example=%s",
			tc.name, inversions, trials, hardGtGood, trials, goodGtEasy, trials, example)
	}
}

func ptrTime(t time.Time) *time.Time { return &t }

// crude parser: returns comparable days (note: "Nmo"/"Ny" are coarse)
func intervalDaysApprox(s string) float64 {
	var n float64
	var unit string
	fmt.Sscanf(s, "%f%s", &n, &unit)
	switch unit {
	case "m":
		return n / (60 * 24)
	case "h":
		return n / 24
	case "d":
		return n
	case "mo":
		return n * 30
	case "y":
		return n * 365
	default:
		return 0
	}
}

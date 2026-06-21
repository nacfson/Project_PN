package words

import (
	"math"
	"math/rand"
	"strings"
	"time"
)

const (
	fsrsDecay         = -0.5
	fsrsFactor        = 0.23456790123456783
	fsrsMinDifficulty = 1.0
	fsrsMaxDifficulty = 10.0
	fsrsMinStability  = 0.1

	// MinReviewsForOptimization is the minimum number of review attempts needed
	// before FSRS weight optimization can produce meaningful results.
	MinReviewsForOptimization = 1000
)

// defaultFSRSWeights returns the public FSRS v4 default weights. Used until the
// app has enough review history to support user-specific parameter optimization.
func defaultFSRSWeights() []float64 {
	return []float64{
		0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
		1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
		1.8729, 0.5425, 0.0912,
	}
}

// ClassifyScoreToRating converts the frontend's 0.0-3.0 slider score to the
// four Anki/FSRS answer buttons.
func ClassifyScoreToRating(score float64) string {
	switch {
	case score < 0.75:
		return "again"
	case score < 1.5:
		return "hard"
	case score < 2.25:
		return "good"
	default:
		return "easy"
	}
}

type FSRSState struct {
	State          string
	Stability      float64
	Difficulty     float64
	ScheduledDays  int
	ReviewCount    int
	LapseCount     int
	LastReviewedAt *time.Time
	RemainingSteps int
}

func (s FSRSState) normalizedState() string {
	switch strings.ToLower(strings.TrimSpace(s.State)) {
	case "learning":
		return "Learning"
	case "review":
		return "Review"
	case "relearning":
		return "Relearning"
	default:
		return "New"
	}
}

// SchedulerConfig is passed into CalculateNextFSRSState to drive per-user
// settings: learning steps, relearning steps, desired retention, fuzz, and
// custom FSRS weights.
type SchedulerConfig struct {
	LearningSteps    []int     // minutes
	RelearningSteps  []int     // minutes
	DesiredRetention float64
	FuzzEnabled      bool
	Weights          []float64
}

// DefaultSchedulerConfig returns Anki-standard scheduler defaults.
func DefaultSchedulerConfig() SchedulerConfig {
	return SchedulerConfig{
		LearningSteps:    []int{1, 10},
		RelearningSteps:  []int{10},
		DesiredRetention: 0.90,
		FuzzEnabled:      true,
		Weights:          defaultFSRSWeights(),
	}
}

// SchedulerConfigFromSettings builds a SchedulerConfig from a ReviewSettings.
func SchedulerConfigFromSettings(s ReviewSettings) SchedulerConfig {
	cfg := SchedulerConfig{
		LearningSteps:    s.LearningSteps,
		RelearningSteps:  s.RelearningSteps,
		DesiredRetention: s.DesiredRetention,
		FuzzEnabled:      s.FuzzEnabled,
		Weights:          s.FSRSWeights,
	}
	if len(cfg.LearningSteps) == 0 {
		cfg.LearningSteps = []int{1, 10}
	}
	if len(cfg.RelearningSteps) == 0 {
		cfg.RelearningSteps = []int{10}
	}
	if cfg.DesiredRetention <= 0 || cfg.DesiredRetention >= 1 {
		cfg.DesiredRetention = 0.90
	}
	if len(cfg.Weights) != 19 {
		cfg.Weights = defaultFSRSWeights()
	}
	return cfg
}

// CalculateNextFSRSState calculates the next card state using the FSRS DSR
// memory model with Anki-style learning/relearning step progression.
//
// State transitions:
//   - New + again/hard → Learning, advance through learning_steps (minutes)
//   - New + good/easy   → Review directly, day-level FSRS scheduling
//   - Learning          → advance or reset steps; graduate to Review when exhausted
//   - Review + again    → Relearning, advance through relearning_steps (minutes)
//   - Relearning        → advance or reset steps; graduate to Review when exhausted
//   - Review + hard/good/easy → day-level FSRS scheduling (unchanged)
func CalculateNextFSRSState(curr FSRSState, score float64, responseTimeMs *int, now time.Time, cfg SchedulerConfig) (FSRSState, string, time.Time) {
	rating := ClassifyScoreToRating(score)
	grade := ratingGrade(rating)
	state := curr.normalizedState()
	w := cfg.Weights

	next := curr
	next.ReviewCount = curr.ReviewCount + 1
	next.LastReviewedAt = &now

	switch state {
	case "New":
		if rating == "again" || rating == "hard" {
			// Enter Learning state with step progression.
			next.State = "Learning"
			next.RemainingSteps = len(cfg.LearningSteps) - 1
			next.Difficulty = initialDifficulty(w, grade)
			next.Stability = initialStability(w, grade)
			dueAt := now.Add(time.Duration(cfg.LearningSteps[0]) * time.Minute)
			next.ScheduledDays = 0
			return next, rating, dueAt
		}
		// "good" or "easy": graduate directly to Review.
		next.State = "Review"
		next.RemainingSteps = 0
		next.Difficulty = initialDifficulty(w, grade)
		next.Stability = initialStability(w, grade)
		next.Stability = clampStability(next.Stability)
		next.ScheduledDays = scheduledDays(w, next.Stability, rating, cfg.DesiredRetention, cfg.FuzzEnabled)
		dueAt := now.AddDate(0, 0, next.ScheduledDays)
		return next, rating, dueAt

	case "Learning":
		if rating == "again" {
			// Reset to first step.
			next.RemainingSteps = len(cfg.LearningSteps) - 1
			next.Difficulty = nextDifficulty(w, curr.Difficulty, grade)
			dueAt := now.Add(time.Duration(cfg.LearningSteps[0]) * time.Minute)
			next.ScheduledDays = 0
			return next, rating, dueAt
		}

		// Advance one step.
		next.RemainingSteps = curr.RemainingSteps - 1
		next.Difficulty = nextDifficulty(w, curr.Difficulty, grade)

		if next.RemainingSteps > 0 {
			// Still in learning steps — schedule next step in minutes.
			stepIdx := len(cfg.LearningSteps) - 1 - next.RemainingSteps
			if stepIdx < 0 {
				stepIdx = 0
			}
			stepIdx = min(stepIdx, len(cfg.LearningSteps)-1)
			dueAt := now.Add(time.Duration(cfg.LearningSteps[stepIdx]) * time.Minute)
			next.ScheduledDays = 0
			return next, rating, dueAt
		}

		// Graduated from Learning → Review.
		next.State = "Review"
		next.RemainingSteps = 0
		next.Stability = clampStability(curr.Stability)
		next.ScheduledDays = scheduledDays(w, next.Stability, rating, cfg.DesiredRetention, cfg.FuzzEnabled)
		dueAt := now.AddDate(0, 0, next.ScheduledDays)
		return next, rating, dueAt

	case "Relearning":
		if rating == "again" {
			// Reset to first relearning step.
			next.RemainingSteps = len(cfg.RelearningSteps) - 1
			next.Difficulty = nextDifficulty(w, curr.Difficulty, grade)
			dueAt := now.Add(time.Duration(cfg.RelearningSteps[0]) * time.Minute)
			next.ScheduledDays = 0
			return next, rating, dueAt
		}

		// Advance one step.
		next.RemainingSteps = curr.RemainingSteps - 1
		next.Difficulty = nextDifficulty(w, curr.Difficulty, grade)

		if next.RemainingSteps > 0 {
			stepIdx := len(cfg.RelearningSteps) - 1 - next.RemainingSteps
			if stepIdx < 0 {
				stepIdx = 0
			}
			stepIdx = min(stepIdx, len(cfg.RelearningSteps)-1)
			dueAt := now.Add(time.Duration(cfg.RelearningSteps[stepIdx]) * time.Minute)
			next.ScheduledDays = 0
			return next, rating, dueAt
		}

		// Graduated from Relearning → Review.
		next.State = "Review"
		next.RemainingSteps = 0
		// Re-compute stability after relearning graduation.
		elapsedDays := elapsedDays(curr.LastReviewedAt, now)
		retrievability := forgettingCurve(w, float64(elapsedDays), curr.Stability)
		next.Stability = clampStability(nextForgetStability(w, curr.Difficulty, curr.Stability, retrievability))
		next.ScheduledDays = scheduledDays(w, next.Stability, rating, cfg.DesiredRetention, cfg.FuzzEnabled)
		dueAt := now.AddDate(0, 0, next.ScheduledDays)
		return next, rating, dueAt

	default: // "Review"
		if rating == "again" {
			// Lapse → enter Relearning.
			next.State = "Relearning"
			next.LapseCount = curr.LapseCount + 1
			next.RemainingSteps = len(cfg.RelearningSteps) - 1
			elapsedDays := elapsedDays(curr.LastReviewedAt, now)
			retrievability := forgettingCurve(w, float64(elapsedDays), curr.Stability)
			next.Difficulty = nextDifficulty(w, curr.Difficulty, grade)
			next.Stability = nextForgetStability(w, curr.Difficulty, curr.Stability, retrievability)
			dueAt := now.Add(time.Duration(cfg.RelearningSteps[0]) * time.Minute)
			next.ScheduledDays = 0
			return next, rating, dueAt
		}

		// Normal review: hard/good/easy.
		next.State = "Review"
		next.RemainingSteps = 0
		elapsedDays := elapsedDays(curr.LastReviewedAt, now)
		retrievability := forgettingCurve(w, float64(elapsedDays), curr.Stability)
		next.Difficulty = nextDifficulty(w, curr.Difficulty, grade)
		next.Stability = nextRecallStability(w, next.Difficulty, curr.Stability, retrievability, rating, score, responseTimeMs)
		next.Stability = clampStability(next.Stability)
		next.ScheduledDays = scheduledDays(w, next.Stability, rating, cfg.DesiredRetention, cfg.FuzzEnabled)
		dueAt := now.AddDate(0, 0, next.ScheduledDays)
		return next, rating, dueAt
	}
}

func initialStability(w []float64, grade int) float64 {
	idx := grade - 1
	if idx < 0 {
		idx = 0
	}
	if idx > 3 {
		idx = 3
	}
	return w[idx]
}

func initialDifficulty(w []float64, grade int) float64 {
	return clamp(w[4]-math.Exp(float64(grade-1)*w[5])+1, fsrsMinDifficulty, fsrsMaxDifficulty)
}

func nextDifficulty(w []float64, current float64, grade int) float64 {
	delta := -w[6] * (float64(grade) - 3)
	next := w[7]*initialDifficulty(w, 4) + (1-w[7])*(current+delta)
	return clamp(next, fsrsMinDifficulty, fsrsMaxDifficulty)
}

func nextRecallStability(w []float64, difficulty, stability, retrievability float64, rating string, score float64, responseTimeMs *int) float64 {
	hardPenalty := 1.0
	if rating == "hard" {
		hardPenalty = w[15]
	}
	easyBonus := 1.0
	if rating == "easy" {
		easyBonus = w[16]
	}

	growth := math.Exp(w[8]) *
		(11 - difficulty) *
		math.Pow(stability, -w[9]) *
		(math.Exp((1-retrievability)*w[10]) - 1) *
		hardPenalty *
		easyBonus

	growth *= recallStabilityModifier(score, rating, responseTimeMs)
	return stability * (1 + growth)
}

const (
	recallModifierMin       = 0.94
	recallModifierMax       = 1.06
	recallLatencyFastMs     = 1000.0
	recallLatencySlowMs     = 8000.0
	recallScoreModifierLow  = 0.97
	recallScoreModifierHigh = 1.03
)

func ratingBucketBounds(rating string) (low, high float64) {
	switch rating {
	case "again":
		return 0, 0.75
	case "hard":
		return 0.75, 1.5
	case "good":
		return 1.5, 2.25
	default:
		return 2.25, 3.0
	}
}

// recallStabilityModifier applies a small bounded adjustment from the
// within-bucket slider position and optional response latency.
func recallStabilityModifier(score float64, rating string, responseTimeMs *int) float64 {
	low, high := ratingBucketBounds(rating)
	pos := 0.5
	if high > low {
		pos = (score - low) / (high - low)
		pos = clamp(pos, 0, 1)
	}
	scoreMod := recallScoreModifierLow + (recallScoreModifierHigh-recallScoreModifierLow)*pos

	latencyMod := 1.0
	if responseTimeMs != nil && *responseTimeMs > 0 {
		ms := float64(*responseTimeMs)
		switch {
		case ms <= recallLatencyFastMs:
			latencyMod = recallScoreModifierHigh
		case ms >= recallLatencySlowMs:
			latencyMod = recallScoreModifierLow
		default:
			ratio := (ms - recallLatencyFastMs) / (recallLatencySlowMs - recallLatencyFastMs)
			latencyMod = recallScoreModifierHigh - (recallScoreModifierHigh-recallScoreModifierLow)*ratio
		}
	}

	return clamp(scoreMod*latencyMod, recallModifierMin, recallModifierMax)
}

func nextForgetStability(w []float64, difficulty, stability, retrievability float64) float64 {
	return w[11] *
		math.Pow(difficulty, -w[12]) *
		(math.Pow(stability+1, w[13]) - 1) *
		math.Exp((1-retrievability)*w[14])
}

func forgettingCurve(w []float64, elapsedDays, stability float64) float64 {
	if stability <= 0 {
		return 0
	}
	return math.Pow(1+fsrsFactor*elapsedDays/stability, fsrsDecay)
}

func scheduledDays(w []float64, stability float64, rating string, desiredRetention float64, fuzzEnabled bool) int {
	if rating == "again" {
		return 1
	}
	days := stability / fsrsFactor * (math.Pow(desiredRetention, 1/fsrsDecay) - 1)
	if days < 1 {
		return 1
	}
	result := int(math.Round(days))
	if fuzzEnabled {
		result = fuzzInterval(result)
	}
	if result < 1 {
		result = 1
	}
	return result
}

// fuzzInterval applies Anki-style ±25% random fuzz to the interval.
// Intervals less than 2 days are not fuzzed.
func fuzzInterval(days int) int {
	if days < 2 {
		return days
	}
	fuzzRange := math.Floor(float64(days) * 0.25)
	if fuzzRange < 1 {
		return days
	}
	delta := rand.Intn(int(fuzzRange)*2 + 1) - int(fuzzRange)
	result := days + delta
	if result < 1 {
		result = 1
	}
	return result
}

func ratingGrade(rating string) int {
	switch rating {
	case "again":
		return 1
	case "hard":
		return 2
	case "good":
		return 3
	default:
		return 4
	}
}

func elapsedDays(lastReviewedAt *time.Time, now time.Time) int {
	if lastReviewedAt == nil || lastReviewedAt.IsZero() {
		return 0
	}
	days := int(now.Sub(*lastReviewedAt).Hours() / 24)
	if days < 0 {
		return 0
	}
	return days
}

func clamp(value, min, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func clampStability(s float64) float64 {
	if s < fsrsMinStability {
		return fsrsMinStability
	}
	return s
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// MemoryStateFromSM2 initializes FSRS state for existing review rows. It keeps
// migration deterministic without needing to replay every historical attempt.
func MemoryStateFromSM2(easeFactor float64, intervalDays int) (float64, float64) {
	stability := float64(intervalDays)
	if stability < 1 {
		stability = 1
	}
	difficulty := 11 - easeFactor*3
	return stability, clamp(difficulty, fsrsMinDifficulty, fsrsMaxDifficulty)
}

func EaseFactorFromDifficulty(difficulty float64) float64 {
	ease := (11 - difficulty) / 3
	if ease < 1.3 {
		return 1.3
	}
	if ease > 2.5 {
		return 2.5
	}
	return ease
}

// MapToLearningStage calculates the high-level user-word-sense learning stage.
func MapToLearningStage(reviewCount int, rating string) string {
	if rating == "again" {
		return "learning"
	}

	switch {
	case reviewCount <= 2:
		return "recognized"
	case reviewCount <= 4:
		return "recalled"
	case reviewCount <= 6:
		return "usable"
	default:
		return "mastered"
	}
}

package words

import (
	"math"
)

// MapScoreToQuality converts a raw rating score (0.0 to 3.0) to SM-2 quality (0.0 to 5.0)
// using a piecewise linear mapping:
// - [0.0, 1.0) maps linearly to [0.0, 3.0)
// - [1.0, 3.0] maps linearly to [3.0, 5.0]
func MapScoreToQuality(score float64) float64 {
	var q float64
	if score < 1.0 {
		q = score * 3.0
	} else {
		q = 3.0 + (score-1.0)*1.0
	}
	
	// Clamp boundary to [0.0, 5.0]
	if q < 0.0 {
		return 0.0
	}
	if q > 5.0 {
		return 5.0
	}
	return q
}

// ClassifyQualityToRating converts the SM-2 quality q (0.0 to 5.0) to a standard text rating
func ClassifyQualityToRating(q float64) string {
	if q < 3.0 {
		return "again"
	}
	if q < 4.0 {
		return "hard"
	}
	if q < 5.0 {
		return "good"
	}
	return "easy"
}

// SM2State represents the spaced repetition state of an item
type SM2State struct {
	IntervalDays int
	EaseFactor   float64
	ReviewCount  int
	LapseCount   int
}

// CalculateNextSM2State calculates scheduling parameters using standard SM-2 logic
// adapted for continuous quality float inputs.
func CalculateNextSM2State(currState SM2State, score float64) (SM2State, string) {
	q := MapScoreToQuality(score)
	rating := ClassifyQualityToRating(q)
	
	nextState := currState

	// 1. Update Ease Factor (standard formula, clamped to a minimum of 1.3)
	// EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
	diff := 5.0 - q
	efChange := 0.1 - diff*(0.08+diff*0.02)
	nextState.EaseFactor = currState.EaseFactor + efChange
	if nextState.EaseFactor < 1.3 {
		nextState.EaseFactor = 1.3
	}

	// 2. Update Interval and repetition parameters
	if q < 3.0 {
		// Incorrect review (Forgot / Again)
		nextState.IntervalDays = 1
		nextState.ReviewCount = 0
		nextState.LapseCount = currState.LapseCount + 1
	} else {
		// Correct review
		if currState.ReviewCount == 0 {
			nextState.IntervalDays = 1
		} else if currState.ReviewCount == 1 {
			nextState.IntervalDays = 6
		} else {
			nextInterval := float64(currState.IntervalDays) * currState.EaseFactor
			nextState.IntervalDays = int(math.Round(nextInterval))
		}
		
		nextState.ReviewCount = currState.ReviewCount + 1
	}

	return nextState, rating
}

// MapToLearningStage calculates the high-level user-word-sense learning stage
func MapToLearningStage(reviewCount int, rating string) string {
	if rating == "again" {
		return "learning"
	}
	
	// Progressive learning stages based on successful review count
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

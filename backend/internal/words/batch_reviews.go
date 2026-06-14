package words

import (
	"context"
	"fmt"
	"time"
)

// RecordBatchReviewAttempts updates spaced repetition review states and logs attempts atomically in a transaction.
func (s *Service) RecordBatchReviewAttempts(ctx context.Context, userID string, attempts []ReviewAttemptParams) (BatchReviewResult, error) {
	if len(attempts) == 0 {
		return BatchReviewResult{XPEarned: 0, Success: true}, nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return BatchReviewResult{}, fmt.Errorf("words: begin batch reviews transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	for _, attempt := range attempts {
		// 1. Fetch current review state for the user word sense
		var uwsID string
		var intervalDays int
		var easeFactor float64
		var reviewCount int
		var lapseCount int
		var currentStage string

		err = tx.QueryRow(ctx, `
			select uws.id::text, rs.interval_days, rs.ease_factor, rs.review_count, rs.lapse_count, uws.learning_stage
			from user_word_senses uws
			join review_states rs on rs.user_word_sense_id = uws.id
			where uws.id = $1::uuid and uws.user_id = $2::uuid
			  and uws.archived_at is null`,
			attempt.UserWordSenseID, userID,
		).Scan(&uwsID, &intervalDays, &easeFactor, &reviewCount, &lapseCount, &currentStage)

		if err != nil {
			return BatchReviewResult{}, fmt.Errorf("words: fetch review state for %s: %w", attempt.UserWordSenseID, err)
		}

		// 2. Compute the next SM-2 state using continuous scheduler logic
		currState := SM2State{
			IntervalDays: intervalDays,
			EaseFactor:   easeFactor,
			ReviewCount:  reviewCount,
			LapseCount:   lapseCount,
		}
		nextState, reviewRating := CalculateNextSM2State(currState, attempt.RatingScore)
		nextStage := MapToLearningStage(nextState.ReviewCount, reviewRating)

		// Calculate next due timestamp
		dueAt := time.Now().AddDate(0, 0, nextState.IntervalDays)

		// 3. Update the review state
		_, err = tx.Exec(ctx, `
			update review_states
			set interval_days = $1,
			    ease_factor = $2,
			    review_count = $3,
			    lapse_count = $4,
			    due_at = $5,
			    updated_at = now()
			where user_word_sense_id = $6::uuid`,
			nextState.IntervalDays,
			nextState.EaseFactor,
			nextState.ReviewCount,
			nextState.LapseCount,
			dueAt,
			attempt.UserWordSenseID,
		)
		if err != nil {
			return BatchReviewResult{}, fmt.Errorf("words: update review state for %s: %w", attempt.UserWordSenseID, err)
		}

		// 4. Update the user_word_senses stage if it has changed
		if nextStage != currentStage {
			_, err = tx.Exec(ctx, `
				update user_word_senses
				set learning_stage = $1,
				    updated_at = now()
				where id = $2::uuid`,
				nextStage,
				attempt.UserWordSenseID,
			)
			if err != nil {
				return BatchReviewResult{}, fmt.Errorf("words: update learning stage for %s: %w", attempt.UserWordSenseID, err)
			}
		}

		// 5. Insert the review attempt historical log
		_, err = tx.Exec(ctx, `
			insert into review_attempts (
				user_word_sense_id,
				activity_type,
				prompt,
				user_answer,
				correct_answer,
				is_correct,
				review_rating,
				rating_score,
				response_time_ms,
				confidence_rating,
				reviewed_at
			) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())`,
			attempt.UserWordSenseID,
			attempt.ActivityType,
			attempt.Prompt,
			attempt.UserAnswer,
			attempt.CorrectAnswer,
			attempt.IsCorrect,
			reviewRating,
			attempt.RatingScore,
			attempt.ResponseTimeMs,
			attempt.ConfidenceRating,
		)
		if err != nil {
			return BatchReviewResult{}, fmt.Errorf("words: log review attempt for %s: %w", attempt.UserWordSenseID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return BatchReviewResult{}, fmt.Errorf("words: commit batch reviews: %w", err)
	}

	xpEarned := len(attempts) * 10
	return BatchReviewResult{XPEarned: xpEarned, Success: true}, nil
}

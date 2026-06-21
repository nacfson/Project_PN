package words

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
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

	// Load or create review settings for the user.
	settings, err := ensureReviewSettingsTx(ctx, tx, userID)
	if err != nil {
		return BatchReviewResult{}, fmt.Errorf("words: load review settings: %w", err)
	}

	cfg := SchedulerConfigFromSettings(settings)
	now := time.Now().UTC()
	today := now.UTC().Format("2006-01-02")

	for _, attempt := range attempts {
		var uwsID string
		var intervalDays int
		var easeFactor float64
		var reviewCount int
		var lapseCount int
		var currentStage string
		var fsrsState string
		var stability float64
		var difficulty float64
		var scheduledDays int
		var remainingSteps int
		var lastReviewedAt sql.NullTime

		err = tx.QueryRow(ctx, `
			select uws.id::text,
			       rs.interval_days,
			       rs.ease_factor,
			       rs.review_count,
			       rs.lapse_count,
			       uws.learning_stage,
			       rs.fsrs_state,
			       rs.stability,
			       rs.difficulty,
			       rs.scheduled_days,
			       rs.remaining_steps,
			       rs.last_reviewed_at
			from user_word_senses uws
			join review_states rs on rs.user_word_sense_id = uws.id
			where uws.id = $1::uuid and uws.user_id = $2::uuid
			  and uws.archived_at is null
			  and rs.is_suspended = false`,
			attempt.UserWordSenseID, userID,
		).Scan(
			&uwsID,
			&intervalDays,
			&easeFactor,
			&reviewCount,
			&lapseCount,
			&currentStage,
			&fsrsState,
			&stability,
			&difficulty,
			&scheduledDays,
			&remainingSteps,
			&lastReviewedAt,
		)

		if err != nil {
			return BatchReviewResult{}, fmt.Errorf("words: fetch review state for %s: %w", attempt.UserWordSenseID, err)
		}

		var reviewedAt *time.Time
		if lastReviewedAt.Valid {
			reviewedAt = &lastReviewedAt.Time
		}

		if reviewCount > 0 && (stability <= 0 || difficulty <= 0) {
			stability, difficulty = MemoryStateFromSM2(easeFactor, intervalDays)
			if fsrsState == "New" {
				fsrsState = "Review"
			}
		}

		currState := FSRSState{
			State:          fsrsState,
			Stability:      stability,
			Difficulty:     difficulty,
			ScheduledDays:  scheduledDays,
			ReviewCount:    reviewCount,
			LapseCount:     lapseCount,
			LastReviewedAt: reviewedAt,
			RemainingSteps: remainingSteps,
		}

		nextState, reviewRating, dueAt := CalculateNextFSRSState(currState, attempt.RatingScore, attempt.ResponseTimeMs, now, cfg)
		nextStage := MapToLearningStage(nextState.ReviewCount, reviewRating)

		// Check for leech condition.
		isLeech := nextState.LapseCount >= settings.LeechThreshold
		suspendCard := isLeech && settings.LeechAction == "suspend"

		_, err = tx.Exec(ctx, `
			update review_states
			set interval_days = $1,
			    ease_factor = $2,
			    review_count = $3,
			    lapse_count = $4,
			    due_at = $5,
			    last_reviewed_at = $6,
			    fsrs_state = $7,
			    stability = $8,
			    difficulty = $9,
			    scheduled_days = $10,
			    remaining_steps = $11,
			    is_suspended = $12,
			    updated_at = now()
			where user_word_sense_id = $13::uuid`,
			nextState.ScheduledDays,
			EaseFactorFromDifficulty(nextState.Difficulty),
			nextState.ReviewCount,
			nextState.LapseCount,
			dueAt,
			now,
			nextState.State,
			nextState.Stability,
			nextState.Difficulty,
			nextState.ScheduledDays,
			nextState.RemainingSteps,
			suspendCard,
			attempt.UserWordSenseID,
		)
		if err != nil {
			return BatchReviewResult{}, fmt.Errorf("words: update review state for %s: %w", attempt.UserWordSenseID, err)
		}

		// If leech action is suspend, archive the user_word_sense.
		if suspendCard {
			_, err = tx.Exec(ctx, `
				update user_word_senses
				set archived_at = $1, updated_at = now()
				where id = $2::uuid`,
				now, attempt.UserWordSenseID,
			)
			if err != nil {
				return BatchReviewResult{}, fmt.Errorf("words: archive leech card %s: %w", attempt.UserWordSenseID, err)
			}
		}

		if nextStage != currentStage && !suspendCard {
			_, err = tx.Exec(ctx, `
				update user_word_senses
				set learning_stage = $1, updated_at = now()
				where id = $2::uuid`,
				nextStage, attempt.UserWordSenseID,
			)
			if err != nil {
				return BatchReviewResult{}, fmt.Errorf("words: update learning stage for %s: %w", attempt.UserWordSenseID, err)
			}
		}

		// Build metadata for the review attempt, adding leech flag if applicable.
		var metadataBytes []byte
		if isLeech {
			meta := map[string]any{"leech": true}
			metadataBytes, _ = json.Marshal(meta)
		} else {
			metadataBytes = []byte(`{}`)
		}

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
				metadata,
				reviewed_at
			) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())`,
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
			metadataBytes,
		)
		if err != nil {
			return BatchReviewResult{}, fmt.Errorf("words: log review attempt for %s: %w", attempt.UserWordSenseID, err)
		}

		// Update daily review counts.
		isNewCard := currState.normalizedState() == "New"
		if isNewCard {
			_, err = tx.Exec(ctx, `
				insert into daily_review_counts (user_id, review_date, new_cards_done, reviews_done)
				values ($1::uuid, $2::date, 1, 0)
				on conflict (user_id, review_date)
				do update set new_cards_done = daily_review_counts.new_cards_done + 1`,
				userID, today,
			)
		} else {
			_, err = tx.Exec(ctx, `
				insert into daily_review_counts (user_id, review_date, new_cards_done, reviews_done)
				values ($1::uuid, $2::date, 0, 1)
				on conflict (user_id, review_date)
				do update set reviews_done = daily_review_counts.reviews_done + 1`,
				userID, today,
			)
		}
		if err != nil {
			return BatchReviewResult{}, fmt.Errorf("words: update daily counts: %w", err)
		}

		// Bury other senses of the same word for the rest of today (UTC).
		endOfToday := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, time.UTC)
		_, err = tx.Exec(ctx, `
			update review_states
			set buried_until = $1, updated_at = now()
			where user_word_sense_id in (
				select uws2.id
				from user_word_senses uws2
				join word_senses ws2 on ws2.id = uws2.word_sense_id
				join word_senses ws on ws.word_id = ws2.word_id
				join user_word_senses uws on uws.word_sense_id = ws.id
				where uws.id = $2::uuid
				  and uws2.id != uws.id
				  and uws2.user_id = $3::uuid
				  and uws2.archived_at is null
			)`,
			endOfToday, attempt.UserWordSenseID, userID,
		)
		if err != nil {
			return BatchReviewResult{}, fmt.Errorf("words: bury same-word senses for %s: %w", attempt.UserWordSenseID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return BatchReviewResult{}, fmt.Errorf("words: commit batch reviews: %w", err)
	}

	xpEarned := len(attempts) * 10
	return BatchReviewResult{XPEarned: xpEarned, Success: true}, nil
}

// ensureReviewSettingsTx loads the user's review_settings row, creating one
// with defaults if it doesn't exist yet. Must be called within a transaction.
func ensureReviewSettingsTx(ctx context.Context, tx pgx.Tx, userID string) (ReviewSettings, error) {
	settings := DefaultReviewSettings(userID)

	var weightsArr []float64
	var optimizedAt *time.Time
	var weightsReviewCount int

	err := tx.QueryRow(ctx, `
		insert into review_settings (user_id)
		values ($1::uuid)
		on conflict (user_id) do update set updated_at = now()
		returning new_cards_per_day, reviews_per_day, learning_steps, relearning_steps,
		          leech_threshold, leech_action, fuzz_enabled, desired_retention,
		          fsrs_weights, weights_optimized_at, weights_review_count`,
		userID,
	).Scan(
		&settings.NewCardsPerDay,
		&settings.ReviewsPerDay,
		&settings.LearningSteps,
		&settings.RelearningSteps,
		&settings.LeechThreshold,
		&settings.LeechAction,
		&settings.FuzzEnabled,
		&settings.DesiredRetention,
		&weightsArr,
		&optimizedAt,
		&weightsReviewCount,
	)
	if err != nil {
		return ReviewSettings{}, fmt.Errorf("ensure review settings: %w", err)
	}

	if len(weightsArr) == 19 {
		settings.FSRSWeights = weightsArr
	}
	settings.WeightsOptimizedAt = optimizedAt
	settings.WeightsReviewCount = weightsReviewCount

	return settings, nil
}

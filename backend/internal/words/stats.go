package words

import (
	"context"
	"fmt"
	"time"
)

var activeLearningStages = []string{
	"new", "learning", "recognized", "recalled", "usable", "mastered",
}

const statsForecastDays = 14

// GetStatsSummary returns read-only aggregate stats for the user's learning progress.
func (s *Service) GetStatsSummary(ctx context.Context, userID string) (StatsSummary, error) {
	now := time.Now().UTC()
	today := truncateUTC(now)

	reviewsToday, correctToday, err := s.countReviewsToday(ctx, userID, today)
	if err != nil {
		return StatsSummary{}, err
	}

	settings, err := s.ensureReviewSettingsPool(ctx, userID)
	if err != nil {
		return StatsSummary{}, fmt.Errorf("words: load review settings: %w", err)
	}

	streak, err := s.reconcileUserStreak(ctx, userID)
	if err != nil {
		return StatsSummary{}, err
	}

	dueToday, err := s.countDueTodayWithSettings(ctx, userID, settings)
	if err != nil {
		return StatsSummary{}, err
	}

	stageCounts, err := s.stageCounts(ctx, userID)
	if err != nil {
		return StatsSummary{}, err
	}

	forecast, err := s.forecastDueCounts(ctx, userID, today)
	if err != nil {
		return StatsSummary{}, err
	}

	return StatsSummary{
		ReviewStreakDays:   streak.CurrentStreakDays,
		LongestStreakDays:  streak.LongestStreakDays,
		StreakFreezeTokens: streak.StreakFreezeTokens,
		VacationModeActive: vacationModeActive(streak.VacationModeUntil, today),
		StreakAtRisk:       streakAtRisk(streak, today, dueToday),
		DailyGoalXP:        settings.DailyGoalXP,
		ReviewsToday:       reviewsToday,
		CorrectToday:       correctToday,
		DueToday:           dueToday,
		StageCounts:        stageCounts,
		Forecast:           forecast,
	}, nil
}

func (s *Service) CountDueToday(ctx context.Context, userID string) (int, error) {
	return s.countDueToday(ctx, userID)
}

func (s *Service) countDueToday(ctx context.Context, userID string) (int, error) {
	settings, err := s.ensureReviewSettingsPool(ctx, userID)
	if err != nil {
		return 0, fmt.Errorf("words: load review settings: %w", err)
	}
	return s.countDueTodayWithSettings(ctx, userID, settings)
}

func (s *Service) countDueTodayWithSettings(ctx context.Context, userID string, settings ReviewSettings) (int, error) {
	limit := settings.ReviewsPerDay + settings.NewCardsPerDay
	if limit <= 0 {
		return 0, nil
	}

	items, err := s.GetDueReviewItems(ctx, userID, "", limit)
	if err != nil {
		return 0, err
	}
	return len(items), nil
}

func (s *Service) countReviewsToday(ctx context.Context, userID string, today time.Time) (reviews, correct int, err error) {
	tomorrow := today.AddDate(0, 0, 1)
	err = s.pool.QueryRow(ctx, `
		select count(*),
		       count(*) filter (where ra.is_correct = true)
		from review_attempts ra
		join user_word_senses uws on uws.id = ra.user_word_sense_id
		where uws.user_id = $1::uuid
		  and ra.reviewed_at >= $2
		  and ra.reviewed_at < $3`,
		userID, today, tomorrow,
	).Scan(&reviews, &correct)
	if err != nil {
		return 0, 0, fmt.Errorf("words: count reviews today: %w", err)
	}
	return reviews, correct, nil
}

func (s *Service) reviewStreakDays(ctx context.Context, userID string, today time.Time) (int, error) {
	rows, err := s.pool.Query(ctx, `
		select distinct (ra.reviewed_at at time zone 'UTC')::date
		from review_attempts ra
		join user_word_senses uws on uws.id = ra.user_word_sense_id
		where uws.user_id = $1::uuid
		order by 1 desc`,
		userID,
	)
	if err != nil {
		return 0, fmt.Errorf("words: load review streak dates: %w", err)
	}
	defer rows.Close()

	var dates []time.Time
	for rows.Next() {
		var day time.Time
		if err := rows.Scan(&day); err != nil {
			return 0, err
		}
		dates = append(dates, truncateUTC(day))
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	return computeReviewStreakDays(dates, today), nil
}

func computeReviewStreakDays(dates []time.Time, today time.Time) int {
	if len(dates) == 0 {
		return 0
	}

	today = truncateUTC(today)
	first := truncateUTC(dates[0])
	yesterday := today.AddDate(0, 0, -1)

	if first.Before(yesterday) {
		return 0
	}

	streak := 1
	for i := 1; i < len(dates); i++ {
		prev := truncateUTC(dates[i-1])
		cur := truncateUTC(dates[i])
		if prev.AddDate(0, 0, -1).Equal(cur) {
			streak++
			continue
		}
		break
	}
	return streak
}

func truncateUTC(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

func (s *Service) stageCounts(ctx context.Context, userID string) (map[string]int, error) {
	counts := make(map[string]int, len(activeLearningStages))
	for _, stage := range activeLearningStages {
		counts[stage] = 0
	}

	rows, err := s.pool.Query(ctx, `
		select learning_stage, count(*)
		from user_word_senses
		where user_id = $1::uuid
		  and archived_at is null
		  and learning_stage != 'archived'
		group by learning_stage`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("words: load stage counts: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var stage string
		var count int
		if err := rows.Scan(&stage, &count); err != nil {
			return nil, err
		}
		counts[stage] = count
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return counts, nil
}

func (s *Service) forecastDueCounts(ctx context.Context, userID string, today time.Time) ([]StatsForecastDay, error) {
	endDate := today.AddDate(0, 0, statsForecastDays)

	countsByDate := make(map[string]int, statsForecastDays)
	rows, err := s.pool.Query(ctx, `
		select (rs.due_at at time zone 'UTC')::date, count(*)
		from review_states rs
		join user_word_senses uws on uws.id = rs.user_word_sense_id
		where uws.user_id = $1::uuid
		  and uws.archived_at is null
		  and uws.learning_stage != 'archived'
		  and rs.is_suspended = false
		  and (rs.buried_until is null or rs.buried_until <= now())
		  and (rs.due_at at time zone 'UTC')::date >= $2::date
		  and (rs.due_at at time zone 'UTC')::date < $3::date
		group by 1
		order by 1`,
		userID, today, endDate,
	)
	if err != nil {
		return nil, fmt.Errorf("words: load forecast: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var day time.Time
		var count int
		if err := rows.Scan(&day, &count); err != nil {
			return nil, err
		}
		countsByDate[day.Format("2006-01-02")] = count
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	forecast := make([]StatsForecastDay, 0, statsForecastDays)
	for i := 0; i < statsForecastDays; i++ {
		day := today.AddDate(0, 0, i)
		date := day.Format("2006-01-02")
		forecast = append(forecast, StatsForecastDay{
			Date:  date,
			Count: countsByDate[date],
		})
	}
	return forecast, nil
}

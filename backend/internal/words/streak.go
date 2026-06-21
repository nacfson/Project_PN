package words

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	defaultStreakFreezeTokens = 1
	minDailyGoalXP            = 10
	maxDailyGoalXP            = 1000
)

// UserStreak holds durable streak state for a user.
type UserStreak struct {
	UserID             string
	CurrentStreakDays  int
	LongestStreakDays  int
	LastReviewDate     *time.Time
	StreakFreezeTokens int
	VacationModeUntil  *time.Time
}

// StreakSettings is the API response for streak configuration and status.
type StreakSettings struct {
	CurrentStreakDays  int     `json:"current_streak_days"`
	LongestStreakDays  int     `json:"longest_streak_days"`
	StreakFreezeTokens int     `json:"streak_freeze_tokens"`
	VacationModeUntil  *string `json:"vacation_mode_until"`
	VacationModeActive bool    `json:"vacation_mode_active"`
	StreakAtRisk       bool    `json:"streak_at_risk"`
}

// UpdateStreakSettingsParams controls PATCH /api/streaks/settings.
type UpdateStreakSettingsParams struct {
	VacationModeUntil *string
	UseStreakFreeze   *bool
}

// UpdateReviewSettingsParams controls PATCH /api/reviews/settings.
type UpdateReviewSettingsParams struct {
	DesiredRetention *float64
	DailyGoalXP      *int
}

func vacationModeActive(until *time.Time, today time.Time) bool {
	if until == nil {
		return false
	}
	return !truncateUTC(*until).Before(truncateUTC(today))
}

func daysBetween(from, to time.Time) int {
	from = truncateUTC(from)
	to = truncateUTC(to)
	return int(to.Sub(from).Hours() / 24)
}

func dateString(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := truncateUTC(*t).Format("2006-01-02")
	return &s
}

func parseDateString(value string) (time.Time, error) {
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid date %q: %w", value, err)
	}
	return truncateUTC(parsed), nil
}

func streakAtRisk(streak UserStreak, today time.Time, dueToday int) bool {
	if streak.CurrentStreakDays <= 0 || streak.LastReviewDate == nil {
		return false
	}
	if vacationModeActive(streak.VacationModeUntil, today) {
		return false
	}
	if dueToday <= 0 {
		return false
	}
	last := truncateUTC(*streak.LastReviewDate)
	if last.Equal(truncateUTC(today)) {
		return false
	}
	diff := daysBetween(last, today)
	return diff >= 1 && diff <= 2
}

func (streak *UserStreak) reconcileMissedDays(today time.Time) bool {
	if streak.LastReviewDate == nil {
		if streak.CurrentStreakDays != 0 {
			streak.CurrentStreakDays = 0
			return true
		}
		return false
	}
	if vacationModeActive(streak.VacationModeUntil, today) {
		return false
	}

	last := truncateUTC(*streak.LastReviewDate)
	diff := daysBetween(last, today)
	if diff <= 2 {
		return false
	}

	if streak.CurrentStreakDays != 0 {
		streak.CurrentStreakDays = 0
		return true
	}
	return false
}

func applyReviewToStreak(streak *UserStreak, today time.Time) bool {
	today = truncateUTC(today)
	if streak.LastReviewDate != nil && truncateUTC(*streak.LastReviewDate).Equal(today) {
		return false
	}

	changed := false
	if streak.LastReviewDate == nil {
		streak.CurrentStreakDays = 1
		changed = true
	} else {
		last := truncateUTC(*streak.LastReviewDate)
		diff := daysBetween(last, today)
		switch {
		case diff == 1:
			streak.CurrentStreakDays++
			changed = true
		case diff == 2 && streak.StreakFreezeTokens > 0:
			streak.StreakFreezeTokens--
			streak.CurrentStreakDays++
			changed = true
		case diff >= 2 && vacationModeActive(streak.VacationModeUntil, today):
			streak.CurrentStreakDays++
			changed = true
		case diff >= 2:
			streak.CurrentStreakDays = 1
			changed = true
		}
	}

	if streak.CurrentStreakDays > streak.LongestStreakDays {
		streak.LongestStreakDays = streak.CurrentStreakDays
		changed = true
	}
	streak.LastReviewDate = &today
	return changed
}

func applyStreakFreeze(streak *UserStreak, today time.Time) error {
	if streak.StreakFreezeTokens <= 0 {
		return fmt.Errorf("words: no streak freeze tokens available")
	}
	if streak.LastReviewDate == nil {
		return fmt.Errorf("words: streak freeze requires an active streak")
	}
	if vacationModeActive(streak.VacationModeUntil, today) {
		return fmt.Errorf("words: streak freeze unavailable during vacation mode")
	}

	last := truncateUTC(*streak.LastReviewDate)
	diff := daysBetween(last, today)
	if diff != 2 {
		return fmt.Errorf("words: streak freeze can only cover one missed day")
	}

	yesterday := today.AddDate(0, 0, -1)
	streak.StreakFreezeTokens--
	streak.LastReviewDate = &yesterday
	return nil
}

func (s *Service) ensureUserStreak(ctx context.Context, userID string) (UserStreak, error) {
	streak := UserStreak{UserID: userID, StreakFreezeTokens: defaultStreakFreezeTokens}

	var lastReviewDate, vacationUntil *time.Time
	err := s.pool.QueryRow(ctx, `
		select current_streak_days, longest_streak_days, last_review_date,
		       streak_freeze_tokens, vacation_mode_until
		from user_streaks
		where user_id = $1::uuid`,
		userID,
	).Scan(
		&streak.CurrentStreakDays,
		&streak.LongestStreakDays,
		&lastReviewDate,
		&streak.StreakFreezeTokens,
		&vacationUntil,
	)
	if err == nil {
		streak.LastReviewDate = lastReviewDate
		streak.VacationModeUntil = vacationUntil
		return streak, nil
	}
	if err != pgx.ErrNoRows {
		return UserStreak{}, fmt.Errorf("words: load user streak: %w", err)
	}

	bootstrap, err := s.bootstrapUserStreakFromHistory(ctx, userID)
	if err != nil {
		return UserStreak{}, err
	}

	_, err = s.pool.Exec(ctx, `
		insert into user_streaks (
			user_id, current_streak_days, longest_streak_days, last_review_date,
			streak_freeze_tokens, vacation_mode_until
		) values ($1::uuid, $2, $3, $4, $5, null)`,
		userID,
		bootstrap.CurrentStreakDays,
		bootstrap.LongestStreakDays,
		bootstrap.LastReviewDate,
		bootstrap.StreakFreezeTokens,
	)
	if err != nil {
		return UserStreak{}, fmt.Errorf("words: create user streak: %w", err)
	}

	return bootstrap, nil
}

func (s *Service) bootstrapUserStreakFromHistory(ctx context.Context, userID string) (UserStreak, error) {
	today := truncateUTC(time.Now().UTC())

	rows, err := s.pool.Query(ctx, `
		select distinct (ra.reviewed_at at time zone 'UTC')::date
		from review_attempts ra
		join user_word_senses uws on uws.id = ra.user_word_sense_id
		where uws.user_id = $1::uuid
		order by 1 desc`,
		userID,
	)
	if err != nil {
		return UserStreak{}, fmt.Errorf("words: bootstrap streak dates: %w", err)
	}
	defer rows.Close()

	var dates []time.Time
	for rows.Next() {
		var day time.Time
		if err := rows.Scan(&day); err != nil {
			return UserStreak{}, err
		}
		dates = append(dates, truncateUTC(day))
	}
	if err := rows.Err(); err != nil {
		return UserStreak{}, err
	}

	streakDays := computeReviewStreakDays(dates, today)
	streak := UserStreak{
		UserID:             userID,
		CurrentStreakDays:  streakDays,
		LongestStreakDays:  streakDays,
		StreakFreezeTokens: defaultStreakFreezeTokens,
	}
	if len(dates) > 0 {
		last := dates[0]
		streak.LastReviewDate = &last
	}
	return streak, nil
}

func (s *Service) persistUserStreak(ctx context.Context, streak UserStreak) error {
	_, err := s.pool.Exec(ctx, `
		update user_streaks
		set current_streak_days = $1,
		    longest_streak_days = $2,
		    last_review_date = $3,
		    streak_freeze_tokens = $4,
		    vacation_mode_until = $5,
		    updated_at = now()
		where user_id = $6::uuid`,
		streak.CurrentStreakDays,
		streak.LongestStreakDays,
		streak.LastReviewDate,
		streak.StreakFreezeTokens,
		streak.VacationModeUntil,
		streak.UserID,
	)
	if err != nil {
		return fmt.Errorf("words: persist user streak: %w", err)
	}
	return nil
}

func (s *Service) reconcileUserStreak(ctx context.Context, userID string) (UserStreak, error) {
	streak, err := s.ensureUserStreak(ctx, userID)
	if err != nil {
		return UserStreak{}, err
	}

	today := truncateUTC(time.Now().UTC())
	if streak.reconcileMissedDays(today) {
		if err := s.persistUserStreak(ctx, streak); err != nil {
			return UserStreak{}, err
		}
	}
	return streak, nil
}

func (s *Service) applyStreakReview(ctx context.Context, tx pgx.Tx, userID string, reviewedAt time.Time) error {
	streak, err := s.ensureUserStreakTx(ctx, tx, userID)
	if err != nil {
		return err
	}

	today := truncateUTC(reviewedAt.UTC())
	streak.reconcileMissedDays(today)
	if !applyReviewToStreak(&streak, today) {
		return nil
	}

	_, err = tx.Exec(ctx, `
		update user_streaks
		set current_streak_days = $1,
		    longest_streak_days = $2,
		    last_review_date = $3,
		    streak_freeze_tokens = $4,
		    updated_at = now()
		where user_id = $5::uuid`,
		streak.CurrentStreakDays,
		streak.LongestStreakDays,
		streak.LastReviewDate,
		streak.StreakFreezeTokens,
		userID,
	)
	if err != nil {
		return fmt.Errorf("words: update streak on review: %w", err)
	}
	return nil
}

func (s *Service) ensureUserStreakTx(ctx context.Context, tx pgx.Tx, userID string) (UserStreak, error) {
	streak := UserStreak{UserID: userID, StreakFreezeTokens: defaultStreakFreezeTokens}

	var lastReviewDate, vacationUntil *time.Time
	err := tx.QueryRow(ctx, `
		select current_streak_days, longest_streak_days, last_review_date,
		       streak_freeze_tokens, vacation_mode_until
		from user_streaks
		where user_id = $1::uuid`,
		userID,
	).Scan(
		&streak.CurrentStreakDays,
		&streak.LongestStreakDays,
		&lastReviewDate,
		&streak.StreakFreezeTokens,
		&vacationUntil,
	)
	if err == nil {
		streak.LastReviewDate = lastReviewDate
		streak.VacationModeUntil = vacationUntil
		return streak, nil
	}
	if err != pgx.ErrNoRows {
		return UserStreak{}, fmt.Errorf("words: load user streak in tx: %w", err)
	}

	bootstrap, err := s.bootstrapUserStreakFromHistory(ctx, userID)
	if err != nil {
		return UserStreak{}, err
	}

	_, err = tx.Exec(ctx, `
		insert into user_streaks (
			user_id, current_streak_days, longest_streak_days, last_review_date,
			streak_freeze_tokens, vacation_mode_until
		) values ($1::uuid, $2, $3, $4, $5, null)`,
		userID,
		bootstrap.CurrentStreakDays,
		bootstrap.LongestStreakDays,
		bootstrap.LastReviewDate,
		bootstrap.StreakFreezeTokens,
	)
	if err != nil {
		return UserStreak{}, fmt.Errorf("words: create user streak in tx: %w", err)
	}
	return bootstrap, nil
}

func (s *Service) GetStreakSettings(ctx context.Context, userID string, dueToday int) (StreakSettings, error) {
	streak, err := s.reconcileUserStreak(ctx, userID)
	if err != nil {
		return StreakSettings{}, err
	}

	today := truncateUTC(time.Now().UTC())
	return StreakSettings{
		CurrentStreakDays:  streak.CurrentStreakDays,
		LongestStreakDays:  streak.LongestStreakDays,
		StreakFreezeTokens: streak.StreakFreezeTokens,
		VacationModeUntil:  dateString(streak.VacationModeUntil),
		VacationModeActive: vacationModeActive(streak.VacationModeUntil, today),
		StreakAtRisk:       streakAtRisk(streak, today, dueToday),
	}, nil
}

func (s *Service) UpdateStreakSettings(ctx context.Context, userID string, params UpdateStreakSettingsParams) (StreakSettings, error) {
	streak, err := s.reconcileUserStreak(ctx, userID)
	if err != nil {
		return StreakSettings{}, err
	}

	today := truncateUTC(time.Now().UTC())
	changed := false

	if params.VacationModeUntil != nil {
		if *params.VacationModeUntil == "" {
			streak.VacationModeUntil = nil
			changed = true
		} else {
			until, err := parseDateString(*params.VacationModeUntil)
			if err != nil {
				return StreakSettings{}, err
			}
			if until.Before(today) {
				return StreakSettings{}, fmt.Errorf("words: vacation_mode_until must be today or later")
			}
			streak.VacationModeUntil = &until
			changed = true
		}
	}

	if params.UseStreakFreeze != nil && *params.UseStreakFreeze {
		if err := applyStreakFreeze(&streak, today); err != nil {
			return StreakSettings{}, err
		}
		changed = true
	}

	if changed {
		if err := s.persistUserStreak(ctx, streak); err != nil {
			return StreakSettings{}, err
		}
	}

	dueToday, err := s.countDueToday(ctx, userID)
	if err != nil {
		return StreakSettings{}, err
	}
	return s.GetStreakSettings(ctx, userID, dueToday)
}

func clampDailyGoalXP(value int) int {
	if value < minDailyGoalXP {
		return minDailyGoalXP
	}
	if value > maxDailyGoalXP {
		return maxDailyGoalXP
	}
	return value
}

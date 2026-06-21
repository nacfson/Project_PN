package words

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	notificationBackoff       = 4 * time.Hour
	slippingRetrievabilityMin = 0.70
)

// PushTokenRegistration stores or refreshes a device push token for a user.
type PushTokenRegistration struct {
	Token    string
	Platform string
}

// NotificationCandidate is a push message ready to send for one user.
type NotificationCandidate struct {
	UserID           string
	NotificationType string
	Title            string
	Body             string
	Tokens           []string
}

// RegisterPushToken upserts a device token for the authenticated user.
func (s *Service) RegisterPushToken(ctx context.Context, userID string, reg PushTokenRegistration) error {
	token := trimSpace(reg.Token)
	platform := trimSpace(reg.Platform)
	if token == "" {
		return fmt.Errorf("words: push token is required")
	}
	switch platform {
	case "ios", "android", "web":
	default:
		return fmt.Errorf("words: invalid push platform")
	}

	_, err := s.pool.Exec(ctx, `
		insert into device_push_tokens (user_id, token, platform, last_seen_at)
		values ($1::uuid, $2, $3, now())
		on conflict (user_id, token) do update
		set platform = excluded.platform,
		    last_seen_at = now()`,
		userID, token, platform,
	)
	if err != nil {
		return fmt.Errorf("words: register push token: %w", err)
	}
	return nil
}

// PreferredReviewHourUTC returns the median review hour (0-23) from recent attempts.
func PreferredReviewHourUTC(attemptHours []int) int {
	if len(attemptHours) == 0 {
		return 9
	}
	sorted := append([]int(nil), attemptHours...)
	for i := 1; i < len(sorted); i++ {
		key := sorted[i]
		j := i - 1
		for j >= 0 && sorted[j] > key {
			sorted[j+1] = sorted[j]
			j--
		}
		sorted[j+1] = key
	}
	mid := len(sorted) / 2
	if len(sorted)%2 == 0 {
		return (sorted[mid-1] + sorted[mid]) / 2
	}
	return sorted[mid]
}

// WithinPreferredSendWindow returns true when now is within ±1 hour of preferredHour.
func WithinPreferredSendWindow(now time.Time, preferredHour int) bool {
	current := now.UTC().Hour()
	diff := current - preferredHour
	if diff < 0 {
		diff = -diff
	}
	if diff <= 1 {
		return true
	}
	if preferredHour <= 1 && current >= 23 {
		return true
	}
	if preferredHour >= 23 && current <= 1 {
		return true
	}
	return false
}

// Retrievability estimates recall probability from elapsed days and stability.
func Retrievability(elapsedDays, stability float64) float64 {
	if stability <= 0 {
		return 0
	}
	return math.Pow(1+fsrsFactor*elapsedDays/stability, fsrsDecay)
}

func (s *Service) loadReviewAttemptHours(ctx context.Context, userID string, since time.Time) ([]int, error) {
	rows, err := s.pool.Query(ctx, `
		select extract(hour from ra.reviewed_at at time zone 'UTC')::int
		from review_attempts ra
		join user_word_senses uws on uws.id = ra.user_word_sense_id
		where uws.user_id = $1::uuid
		  and ra.reviewed_at >= $2`,
		userID, since,
	)
	if err != nil {
		return nil, fmt.Errorf("words: load review hours: %w", err)
	}
	defer rows.Close()

	var hours []int
	for rows.Next() {
		var hour int
		if err := rows.Scan(&hour); err != nil {
			return nil, err
		}
		hours = append(hours, hour)
	}
	return hours, rows.Err()
}

func (s *Service) countSlippingWords(ctx context.Context, userID string) (int, error) {
	rows, err := s.pool.Query(ctx, `
		select rs.stability,
		       extract(epoch from (now() - coalesce(rs.last_reviewed_at, rs.due_at))) / 86400.0
		from review_states rs
		join user_word_senses uws on uws.id = rs.user_word_sense_id
		where uws.user_id = $1::uuid
		  and uws.archived_at is null
		  and uws.learning_stage != 'archived'
		  and rs.is_suspended = false
		  and rs.stability > 0`,
		userID,
	)
	if err != nil {
		return 0, fmt.Errorf("words: count slipping words: %w", err)
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var stability, elapsedDays float64
		if err := rows.Scan(&stability, &elapsedDays); err != nil {
			return 0, err
		}
		if Retrievability(elapsedDays, stability) < slippingRetrievabilityMin {
			count++
		}
	}
	return count, rows.Err()
}

func (s *Service) lastNotificationSentAt(ctx context.Context, userID string) (*time.Time, error) {
	var sentAt time.Time
	err := s.pool.QueryRow(ctx, `
		select sent_at
		from notification_sends
		where user_id = $1::uuid
		order by sent_at desc
		limit 1`,
		userID,
	).Scan(&sentAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("words: load last notification: %w", err)
	}
	return &sentAt, nil
}

func (s *Service) loadUserPushTokens(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		select token
		from device_push_tokens
		where user_id = $1::uuid`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("words: load push tokens: %w", err)
	}
	defer rows.Close()

	var tokens []string
	for rows.Next() {
		var token string
		if err := rows.Scan(&token); err != nil {
			return nil, err
		}
		tokens = append(tokens, token)
	}
	return tokens, rows.Err()
}

// RecordNotificationSend persists a sent notification for backoff tracking.
func (s *Service) RecordNotificationSend(ctx context.Context, userID, notificationType, title, body string) error {
	_, err := s.pool.Exec(ctx, `
		insert into notification_sends (user_id, notification_type, title, body)
		values ($1::uuid, $2, $3, $4)`,
		userID, notificationType, title, body,
	)
	if err != nil {
		return fmt.Errorf("words: record notification send: %w", err)
	}
	return nil
}

// BuildNotificationCandidates evaluates due/slipping triggers with smart timing and backoff.
func (s *Service) BuildNotificationCandidates(ctx context.Context, now time.Time) ([]NotificationCandidate, error) {
	rows, err := s.pool.Query(ctx, `
		select distinct user_id
		from device_push_tokens`)
	if err != nil {
		return nil, fmt.Errorf("words: list notification users: %w", err)
	}
	defer rows.Close()

	var userIDs []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		userIDs = append(userIDs, userID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	candidates := make([]NotificationCandidate, 0, len(userIDs))
	for _, userID := range userIDs {
		candidate, ok, err := s.buildUserNotificationCandidate(ctx, userID, now)
		if err != nil {
			return nil, err
		}
		if ok {
			candidates = append(candidates, candidate)
		}
	}
	return candidates, nil
}

func (s *Service) buildUserNotificationCandidate(ctx context.Context, userID string, now time.Time) (NotificationCandidate, bool, error) {
	lastSent, err := s.lastNotificationSentAt(ctx, userID)
	if err != nil {
		return NotificationCandidate{}, false, err
	}
	if lastSent != nil && now.Sub(*lastSent) < notificationBackoff {
		return NotificationCandidate{}, false, nil
	}

	hours, err := s.loadReviewAttemptHours(ctx, userID, now.AddDate(0, 0, -30))
	if err != nil {
		return NotificationCandidate{}, false, err
	}
	if !WithinPreferredSendWindow(now, PreferredReviewHourUTC(hours)) {
		return NotificationCandidate{}, false, nil
	}

	dueToday, err := s.countDueToday(ctx, userID)
	if err != nil {
		return NotificationCandidate{}, false, err
	}
	slipping, err := s.countSlippingWords(ctx, userID)
	if err != nil {
		return NotificationCandidate{}, false, err
	}

	var notificationType, title, body string
	switch {
	case dueToday > 0:
		notificationType = "due_review"
		title = "Reviews waiting"
		body = fmt.Sprintf("%d cards are due — keep your memory fresh.", dueToday)
	case slipping > 0:
		notificationType = "words_slipping"
		title = "Words slipping"
		body = fmt.Sprintf("%d words are fading — a quick review helps.", slipping)
	default:
		return NotificationCandidate{}, false, nil
	}

	tokens, err := s.loadUserPushTokens(ctx, userID)
	if err != nil {
		return NotificationCandidate{}, false, err
	}
	if len(tokens) == 0 {
		return NotificationCandidate{}, false, nil
	}

	return NotificationCandidate{
		UserID:           userID,
		NotificationType: notificationType,
		Title:            title,
		Body:             body,
		Tokens:           tokens,
	}, true, nil
}

func trimSpace(value string) string {
	start := 0
	for start < len(value) && (value[start] == ' ' || value[start] == '\t' || value[start] == '\n' || value[start] == '\r') {
		start++
	}
	end := len(value)
	for end > start && (value[end-1] == ' ' || value[end-1] == '\t' || value[end-1] == '\n' || value[end-1] == '\r') {
		end--
	}
	return value[start:end]
}

package words

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// WordOfTheDay is the daily discovery word for a user.
type WordOfTheDay struct {
	Date         string      `json:"date"`
	SenseOptions []SenseOption `json:"sense_options"`
}

// ContentChallenge is a themed challenge stub until collections exist.
type ContentChallenge struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	WordCount   int    `json:"word_count"`
	Status      string `json:"status"`
}

// GetWordOfTheDay returns one word the user has not added yet, stable for the UTC day.
func (s *Service) GetWordOfTheDay(ctx context.Context, userID, langCode, defLangCode string) (WordOfTheDay, error) {
	langCode, defLangCode = s.fillLangs(langCode, defLangCode)
	today := truncateUTC(time.Now().UTC()).Format("2006-01-02")

	var wordID string
	err := s.pool.QueryRow(ctx, `
		select w.id
		from words w
		where w.language_code = $2
		  and not exists (
		    select 1
		    from word_senses ws
		    join user_word_senses uws on uws.word_sense_id = ws.id
		    where ws.word_id = w.id
		      and uws.user_id = $1::uuid
		      and uws.archived_at is null
		      and uws.learning_stage != 'archived'
		  )
		order by md5(w.id::text || $3)
		limit 1`,
		userID, langCode, today,
	).Scan(&wordID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return WordOfTheDay{Date: today, SenseOptions: []SenseOption{}}, nil
		}
		return WordOfTheDay{}, fmt.Errorf("words: pick word of the day: %w", err)
	}

	if _, err := s.ensureTranslationsForWord(ctx, []string{wordID}, defLangCode); err != nil {
		return WordOfTheDay{}, err
	}

	options, err := loadSenseOptions(ctx, s.pool, []string{wordID}, defLangCode)
	if err != nil {
		return WordOfTheDay{}, err
	}

	return WordOfTheDay{
		Date:         today,
		SenseOptions: options,
	}, nil
}

// ListContentChallenges returns stub themed challenges until collections ship.
func (s *Service) ListContentChallenges(_ context.Context, _ string) []ContentChallenge {
	return []ContentChallenge{
		{
			ID:          "daily-capture",
			Title:       "Capture week",
			Description: "Review words you captured from reading this week.",
			WordCount:   0,
			Status:      "coming_soon",
		},
		{
			ID:          "exam-prep",
			Title:       "Exam sprint",
			Description: "Themed word lists for test prep — collections coming soon.",
			WordCount:   0,
			Status:      "coming_soon",
		},
	}
}

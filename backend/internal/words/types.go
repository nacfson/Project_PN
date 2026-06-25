package words

import "time"

// Example is an example sentence attached to a sense.
type Example struct {
	Sentence             string  `json:"sentence"`
	Difficulty           *string `json:"difficulty"`
	LocalizedTranslation *string `json:"localized_translation"`
}

// SenseOption is one selectable, concrete word sense returned by a lookup.
// It is intentionally flattened (word + sense fields together) so the client
// can render and select a single word_sense_id directly.
type SenseOption struct {
	WordID                   string    `json:"word_id"`
	WordSenseID              string    `json:"word_sense_id"`
	LanguageCode             string    `json:"language_code"`
	Lemma                    string    `json:"lemma"`
	NormalizedText           string    `json:"normalized_text"`
	PartOfSpeech             string    `json:"part_of_speech"`
	Pronunciation            *string   `json:"pronunciation"`
	DisplayLanguageCode      string    `json:"display_language_code"`
	Definition               string    `json:"definition"`
	ShortDefinition          *string   `json:"short_definition"`
	LocalizedDefinition      string    `json:"localized_definition"`
	LocalizedShortDefinition *string   `json:"localized_short_definition"`
	CEFRLevel                *string   `json:"cefr_level"`
	MeaningOrder             int       `json:"meaning_order"`
	Examples                 []Example `json:"examples"`
}

// LookupResult is the flattened response shape for /api/words/lookup.
type LookupResult struct {
	Query          string        `json:"query"`
	NormalizedText string        `json:"normalized_text"`
	SenseOptions   []SenseOption `json:"sense_options"`
}

// LearningItem is the personal learnable item created for the dev user.
type LearningItem struct {
	ID            string    `json:"id"`
	WordSenseID   string    `json:"word_sense_id"`
	LearningStage string    `json:"learning_stage"`
	DueAt         time.Time `json:"due_at"`
}

// Deck is a user-owned grouping of vocabulary items for one target language.
type Deck struct {
	ID             string    `json:"id"`
	UserID         string    `json:"user_id"`
	TargetLanguage string    `json:"target_language"`
	Name           string    `json:"name"`
	IsDefault      bool      `json:"is_default"`
	ItemCount      int       `json:"item_count"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// LearningItemsPage is the paginated response for a user's active learning set.
type LearningItemsPage struct {
	Items      []LearningItemListItem `json:"items"`
	NextCursor *string                `json:"next_cursor"`
}

// LearningItemListItem is a flattened user-owned word sense for list views.
type LearningItemListItem struct {
	ID                       string    `json:"id"`
	WordSenseID              string    `json:"word_sense_id"`
	WordID                   string    `json:"word_id"`
	LanguageCode             string    `json:"language_code"`
	Lemma                    string    `json:"lemma"`
	NormalizedText           string    `json:"normalized_text"`
	PartOfSpeech             string    `json:"part_of_speech"`
	Pronunciation            *string   `json:"pronunciation"`
	DisplayLanguageCode      string    `json:"display_language_code"`
	Definition               string    `json:"definition"`
	ShortDefinition          *string   `json:"short_definition"`
	LocalizedDefinition      string    `json:"localized_definition"`
	LocalizedShortDefinition *string   `json:"localized_short_definition"`
	CEFRLevel                *string   `json:"cefr_level"`
	MeaningOrder             int       `json:"meaning_order"`
	LearningStage            string    `json:"learning_stage"`
	DueAt                    time.Time `json:"due_at"`
	AddedAt                  time.Time `json:"added_at"`
	Examples                 []Example `json:"examples"`
}

type ListLearningItemsParams struct {
	Limit        int
	Descending   bool
	Cursor       *LearningItemsCursor
	Search       string
	LanguageCode string
	DeckID       string
}

type LearningItemsCursor struct {
	AddedAt time.Time
	ID      string
}

// ReviewAttemptParams represents an individual review result submitted in a batch.
type ReviewAttemptParams struct {
	UserWordSenseID  string   `json:"user_word_sense_id"`
	ActivityType     string   `json:"activity_type"`
	Prompt           *string  `json:"prompt"`
	UserAnswer       *string  `json:"user_answer"`
	CorrectAnswer    *string  `json:"correct_answer"`
	IsCorrect        bool     `json:"is_correct"`
	RatingScore      float64  `json:"rating_score"` // raw slider value from 0.0 to 3.0
	ResponseTimeMs   *int     `json:"response_time_ms"`
	ConfidenceRating *int     `json:"confidence_rating"`
}

// IntervalPreview shows the next review interval for one answer button.
type IntervalPreview struct {
	Again string `json:"again"`
	Hard  string `json:"hard"`
	Good  string `json:"good"`
	Easy  string `json:"easy"`
}

// DueItem represents a vocabulary item ready for spaced repetition practice.
type DueItem struct {
	UserWordSenseID          string           `json:"user_word_sense_id"`
	WordSenseID              string           `json:"word_sense_id"`
	WordID                   string           `json:"word_id"`
	LanguageCode             string           `json:"language_code"`
	Lemma                    string           `json:"lemma"`
	NormalizedText           string           `json:"normalized_text"`
	PartOfSpeech             string           `json:"part_of_speech"`
	Pronunciation            *string          `json:"pronunciation"`
	DisplayLanguageCode      string           `json:"display_language_code"`
	Definition               string           `json:"definition"`
	ShortDefinition          *string          `json:"short_definition"`
	LocalizedDefinition      string           `json:"localized_definition"`
	LocalizedShortDefinition *string          `json:"localized_short_definition"`
	CEFRLevel                *string          `json:"cefr_level"`
	MeaningOrder             int              `json:"meaning_order"`
	LearningStage            string           `json:"learning_stage"`
	DueAt                    time.Time        `json:"due_at"`
	PreviewIntervals         *IntervalPreview `json:"preview_intervals,omitempty"`
	Examples                 []Example        `json:"examples"`
}

// BatchReviewResult returns the result of the session batch processing.
type BatchReviewResult struct {
	XPEarned int  `json:"xp_earned"`
	Success  bool `json:"success"`
}

// ReviewSettings holds per-user scheduling configuration (Anki deck-level equivalent).
type ReviewSettings struct {
	UserID             string    `json:"user_id"`
	NewCardsPerDay     int       `json:"new_cards_per_day"`
	ReviewsPerDay      int       `json:"reviews_per_day"`
	LearningSteps      []int     `json:"learning_steps"`    // minutes
	RelearningSteps    []int     `json:"relearning_steps"`  // minutes
	LeechThreshold     int       `json:"leech_threshold"`
	LeechAction        string    `json:"leech_action"`      // 'suspend' | 'tag'
	FuzzEnabled        bool      `json:"fuzz_enabled"`
	DesiredRetention   float64   `json:"desired_retention"`
	DailyGoalXP        int       `json:"daily_goal_xp"`
	FSRSWeights        []float64 `json:"fsrs_weights"`
	WeightsOptimizedAt *time.Time `json:"weights_optimized_at"`
	WeightsReviewCount int       `json:"weights_review_count"`
}

// DefaultReviewSettings returns Anki-standard defaults for a user.
func DefaultReviewSettings(userID string) ReviewSettings {
	return ReviewSettings{
		UserID:           userID,
		NewCardsPerDay:   20,
		ReviewsPerDay:    200,
		LearningSteps:    []int{1, 10},
		RelearningSteps:  []int{10},
		LeechThreshold:   8,
		LeechAction:      "suspend",
		FuzzEnabled:      true,
		DesiredRetention: 0.90,
		DailyGoalXP:      200,
		FSRSWeights:      defaultFSRSWeights(),
	}
}

// OptimizationStatus is the response for GET /api/reviews/optimization-status.
type OptimizationStatus struct {
	FSRSWeights        []float64  `json:"fsrs_weights"`
	WeightsOptimizedAt *time.Time `json:"weights_optimized_at"`
	WeightsReviewCount int        `json:"weights_review_count"`
	MinReviewsForOpt   int        `json:"min_reviews_for_optimization"`
}

// DailyReviewCount tracks per-day quota usage.
type DailyReviewCount struct {
	NewCardsDone int
	ReviewsDone  int
}

// StatsForecastDay is one day in the 14-day due forecast.
type StatsForecastDay struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// StatsSummary is the response for GET /api/stats/summary.
type StatsSummary struct {
	ReviewStreakDays   int                `json:"review_streak_days"`
	LongestStreakDays  int                `json:"longest_streak_days"`
	StreakFreezeTokens int                `json:"streak_freeze_tokens"`
	VacationModeActive bool               `json:"vacation_mode_active"`
	StreakAtRisk       bool               `json:"streak_at_risk"`
	DailyGoalXP        int                `json:"daily_goal_xp"`
	ReviewsToday       int                `json:"reviews_today"`
	CorrectToday       int                `json:"correct_today"`
	DueToday           int                `json:"due_today"`
	StageCounts        map[string]int     `json:"stage_counts"`
	Forecast           []StatsForecastDay `json:"forecast"`
}


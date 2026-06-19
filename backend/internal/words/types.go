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
	WordID                  string    `json:"word_id"`
	WordSenseID             string    `json:"word_sense_id"`
	LanguageCode            string    `json:"language_code"`
	Lemma                   string    `json:"lemma"`
	NormalizedText          string    `json:"normalized_text"`
	PartOfSpeech            string    `json:"part_of_speech"`
	DisplayLanguageCode     string    `json:"display_language_code"`
	Definition              string    `json:"definition"`
	ShortDefinition         *string   `json:"short_definition"`
	LocalizedDefinition     string    `json:"localized_definition"`
	LocalizedShortDefinition *string  `json:"localized_short_definition"`
	CEFRLevel               *string   `json:"cefr_level"`
	MeaningOrder            int       `json:"meaning_order"`
	Examples                []Example `json:"examples"`
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
}

type ListLearningItemsParams struct {
	Limit      int
	Descending bool
	Cursor     *LearningItemsCursor
	Search     string
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

// DueItem represents a vocabulary item ready for spaced repetition practice.
type DueItem struct {
	UserWordSenseID          string    `json:"user_word_sense_id"`
	WordSenseID              string    `json:"word_sense_id"`
	WordID                   string    `json:"word_id"`
	LanguageCode             string    `json:"language_code"`
	Lemma                    string    `json:"lemma"`
	NormalizedText           string    `json:"normalized_text"`
	PartOfSpeech             string    `json:"part_of_speech"`
	DisplayLanguageCode      string    `json:"display_language_code"`
	Definition               string    `json:"definition"`
	ShortDefinition          *string   `json:"short_definition"`
	LocalizedDefinition      string    `json:"localized_definition"`
	LocalizedShortDefinition *string   `json:"localized_short_definition"`
	CEFRLevel                *string   `json:"cefr_level"`
	MeaningOrder             int       `json:"meaning_order"`
	LearningStage            string    `json:"learning_stage"`
	DueAt                    time.Time `json:"due_at"`
	Examples                 []Example `json:"examples"`
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


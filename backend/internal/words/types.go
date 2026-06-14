package words

import "time"

// Example is an example sentence attached to a sense.
type Example struct {
	Sentence    string  `json:"sentence"`
	Translation *string `json:"translation"`
}

// SenseOption is one selectable, concrete word sense returned by a lookup.
// It is intentionally flattened (word + sense fields together) so the client
// can render and select a single word_sense_id directly.
type SenseOption struct {
	WordID                 string    `json:"word_id"`
	WordSenseID            string    `json:"word_sense_id"`
	LanguageCode           string    `json:"language_code"`
	Lemma                  string    `json:"lemma"`
	NormalizedText         string    `json:"normalized_text"`
	PartOfSpeech           string    `json:"part_of_speech"`
	DefinitionLanguageCode string    `json:"definition_language_code"`
	Definition             string    `json:"definition"`
	ShortDefinition        *string   `json:"short_definition"`
	CEFRLevel              *string   `json:"cefr_level"`
	MeaningOrder           int       `json:"meaning_order"`
	Examples               []Example `json:"examples"`
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
	ID                     string    `json:"id"`
	WordSenseID            string    `json:"word_sense_id"`
	WordID                 string    `json:"word_id"`
	LanguageCode           string    `json:"language_code"`
	Lemma                  string    `json:"lemma"`
	NormalizedText         string    `json:"normalized_text"`
	PartOfSpeech           string    `json:"part_of_speech"`
	DefinitionLanguageCode string    `json:"definition_language_code"`
	Definition             string    `json:"definition"`
	ShortDefinition        *string   `json:"short_definition"`
	CEFRLevel              *string   `json:"cefr_level"`
	MeaningOrder           int       `json:"meaning_order"`
	LearningStage          string    `json:"learning_stage"`
	DueAt                  time.Time `json:"due_at"`
	AddedAt                time.Time `json:"added_at"`
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

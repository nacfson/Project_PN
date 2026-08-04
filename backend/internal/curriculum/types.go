package curriculum

import "time"

// Pack is a published curriculum catalog entry with optional enrollment info.
type Pack struct {
	ID             string    `json:"id"`
	Slug           string    `json:"slug"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	TargetLanguage string    `json:"target_language"`
	CEFRBand       string    `json:"cefr_band"`
	SortOrder      int       `json:"sort_order"`
	EntryCount     int       `json:"entry_count"`
	Enrolled       bool      `json:"enrolled"`
	DeckID         *string   `json:"deck_id,omitempty"`
	AddedCount     int       `json:"added_count"`
	SkippedCount   int       `json:"skipped_count"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// PackEntry is a preview row for a pack sense.
type PackEntry struct {
	WordSenseID     string  `json:"word_sense_id"`
	Lemma           string  `json:"lemma"`
	PartOfSpeech    string  `json:"part_of_speech"`
	ShortDefinition *string `json:"short_definition"`
	Definition      string  `json:"definition"`
	CEFRLevel       *string `json:"cefr_level"`
	SortOrder       int     `json:"sort_order"`
	AlreadyLearning bool    `json:"already_learning"`
}

// PackDetail is pack metadata plus a capped entry preview.
type PackDetail struct {
	Pack
	Entries      []PackEntry `json:"entries"`
	EntriesTotal int         `json:"entries_total"`
}

// EnrollResult is returned by POST enroll.
type EnrollResult struct {
	PackID          string `json:"pack_id"`
	Slug            string `json:"slug"`
	DeckID          string `json:"deck_id"`
	AddedCount      int    `json:"added_count"`
	SkippedCount    int    `json:"skipped_count"`
	AlreadyEnrolled bool   `json:"already_enrolled"`
}

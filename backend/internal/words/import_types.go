package words

// AnkiCard represents a single card parsed from an Anki CSV/TXT export.
type AnkiCard struct {
	Front   string `json:"front"`
	Back    string `json:"back"`
	Tags    string `json:"tags,omitempty"`
	Action  string `json:"action,omitempty"` // add, overwrite_meaning, create_new_meaning, skip
}

// AnkiImportRequest is the payload for importing Anki cards.
type AnkiImportRequest struct {
	Cards                  []AnkiCard `json:"cards"`
	LanguageCode           string     `json:"language_code"`
	DefinitionLanguageCode string     `json:"definition_language_code"`
}

// ImportError describes a single card that failed to import.
type ImportError struct {
	Index int    `json:"index"`
	Front string `json:"front"`
	Error string `json:"error"`
}

// AnkiImportResult reports the outcome of an import.
type AnkiImportResult struct {
	Total    int           `json:"total"`
	Imported int           `json:"imported"`
	Skipped  int           `json:"skipped"`
	Failed   int           `json:"failed"`
	Errors   []ImportError `json:"errors,omitempty"`
}

// ImportPreviewItem describes one card's match/conflict state before import.
type ImportPreviewItem struct {
	Index         int           `json:"index"`
	Front         string        `json:"front"`
	Back          string        `json:"back"`
	Status        string        `json:"status"` // new_word, existing_word_match, conflict
	MatchedSenses []SenseOption `json:"matched_senses,omitempty"`
	SuggestedAction string      `json:"suggested_action,omitempty"` // add, overwrite_meaning, create_new_meaning, skip
}

// ImportPreviewResult is the response for the preview endpoint.
type ImportPreviewResult struct {
	Items []ImportPreviewItem `json:"items"`
}

// Import actions.
const (
	ImportActionAdd              = "add"
	ImportActionOverwriteMeaning = "overwrite_meaning"
	ImportActionCreateNewMeaning = "create_new_meaning"
	ImportActionSkip             = "skip"
)

// Import preview statuses.
const (
	ImportStatusNewWord          = "new_word"
	ImportStatusExistingWordMatch = "existing_word_match"
	ImportStatusConflict         = "conflict"
)

package learninglog

import (
	"fmt"
	"strconv"
	"time"
)

type LearningItemAddedParams struct {
	UserID              string
	UWSID               string
	WordSenseID         string
	Lemma               string
	POS                 string
	Definition          string
	LocalizedDefinition string
	LangPair            string
	SourceContext       string
}

type ReviewAttemptedParams struct {
	UserID         string
	UWSID          string
	WordSenseID    string
	Lemma          string
	ActivityType   string
	Rating         string
	IsCorrect      bool
	ResponseTimeMs *int
	LearningStage  string
	FSRSState      string
	Difficulty     string
	Stability      string
	Leech          bool
}

type SenseChangedParams struct {
	UserID              string
	UWSID               string
	WordSenseID         string
	NewWordSenseID      string
	Lemma               string
	Definition          string
	LocalizedDefinition string
}

type LearningItemArchivedParams struct {
	UserID      string
	UWSID       string
	WordSenseID string
	Lemma       string
}

func RowLearningItemAdded(ts time.Time, p LearningItemAddedParams) string {
	return FormatRow(ts, "learning_item_added", [][2]string{
		{"user_id", p.UserID},
		{"uws_id", p.UWSID},
		{"word_sense_id", p.WordSenseID},
		{"lemma", p.Lemma},
		{"pos", p.POS},
		{"definition", p.Definition},
		{"localized_definition", p.LocalizedDefinition},
		{"lang_pair", p.LangPair},
		{"source_context", p.SourceContext},
	})
}

func RowReviewAttempted(ts time.Time, p ReviewAttemptedParams) string {
	fields := [][2]string{
		{"user_id", p.UserID},
		{"uws_id", p.UWSID},
		{"word_sense_id", p.WordSenseID},
		{"lemma", p.Lemma},
		{"activity_type", p.ActivityType},
		{"rating", p.Rating},
		{"is_correct", strconv.FormatBool(p.IsCorrect)},
	}
	if p.ResponseTimeMs != nil {
		fields = append(fields, [2]string{"response_time_ms", strconv.Itoa(*p.ResponseTimeMs)})
	}
	fields = append(fields,
		[2]string{"learning_stage", p.LearningStage},
		[2]string{"fsrs_state", p.FSRSState},
		[2]string{"difficulty", p.Difficulty},
		[2]string{"stability", p.Stability},
		[2]string{"leech", strconv.FormatBool(p.Leech)},
	)
	return FormatRow(ts, "review_attempted", fields)
}

func RowSenseChanged(ts time.Time, p SenseChangedParams) string {
	return FormatRow(ts, "sense_changed", [][2]string{
		{"user_id", p.UserID},
		{"uws_id", p.UWSID},
		{"word_sense_id", p.WordSenseID},
		{"new_word_sense_id", p.NewWordSenseID},
		{"lemma", p.Lemma},
		{"definition", p.Definition},
		{"localized_definition", p.LocalizedDefinition},
	})
}

func RowLearningItemArchived(ts time.Time, p LearningItemArchivedParams) string {
	return FormatRow(ts, "learning_item_archived", [][2]string{
		{"user_id", p.UserID},
		{"uws_id", p.UWSID},
		{"word_sense_id", p.WordSenseID},
		{"lemma", p.Lemma},
	})
}

func FormatFloat(f float64) string {
	return fmt.Sprintf("%g", f)
}

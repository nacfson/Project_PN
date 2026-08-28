package words

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"project-pn/internal/learninglog"
)

type senseLogSnapshot struct {
	Lemma               string
	POS                 string
	Definition          string
	LocalizedDefinition string
}

func (s *Service) senseLogSnapshot(ctx context.Context, wordSenseID, displayLang string) (senseLogSnapshot, error) {
	var snap senseLogSnapshot
	err := s.pool.QueryRow(ctx, `
		select w.normalized_text,
		       coalesce(w.part_of_speech, ''),
		       ws.definition,
		       coalesce(st.definition, ws.definition)
		from word_senses ws
		join words w on w.id = ws.word_id
		left join sense_translations st
		  on st.word_sense_id = ws.id and st.language_code = $2
		where ws.id = $1::uuid`,
		wordSenseID, displayLang,
	).Scan(&snap.Lemma, &snap.POS, &snap.Definition, &snap.LocalizedDefinition)
	if err != nil {
		return senseLogSnapshot{}, fmt.Errorf("words: sense log snapshot: %w", err)
	}
	return snap, nil
}

func (s *Service) emitLearningItemAdded(ctx context.Context, userID, uwsID, wordSenseID, wordLang, displayLang, sourceContext string) {
	snap, err := s.senseLogSnapshot(ctx, wordSenseID, displayLang)
	if err != nil {
		slog.Warn("learning log: sense snapshot failed", "error", err, "word_sense_id", wordSenseID)
		return
	}
	now := time.Now().UTC()
	langPair := wordLang + "-" + displayLang
	s.writeLearningLine(now, learninglog.RowLearningItemAdded(now, learninglog.LearningItemAddedParams{
		UserID:              userID,
		UWSID:               uwsID,
		WordSenseID:         wordSenseID,
		Lemma:               snap.Lemma,
		POS:                 snap.POS,
		Definition:          snap.Definition,
		LocalizedDefinition: snap.LocalizedDefinition,
		LangPair:            langPair,
		SourceContext:       sourceContext,
	}))
}

func (s *Service) emitLearningItemArchived(userID, uwsID, wordSenseID, lemma string, ts time.Time) {
	s.writeLearningLine(ts, learninglog.RowLearningItemArchived(ts, learninglog.LearningItemArchivedParams{
		UserID:      userID,
		UWSID:       uwsID,
		WordSenseID: wordSenseID,
		Lemma:       lemma,
	}))
}

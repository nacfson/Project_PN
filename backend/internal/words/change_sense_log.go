package words

import (
	"context"
	"log/slog"
	"time"

	"project-pn/internal/learninglog"
)

func (s *Service) emitSenseChanged(ctx context.Context, userID, uwsID, oldWordSenseID, newWordSenseID, displayLang string) {
	snap, err := s.senseLogSnapshot(ctx, newWordSenseID, displayLang)
	if err != nil {
		slog.Warn("learning log: sense changed snapshot failed", "error", err, "word_sense_id", newWordSenseID)
		return
	}
	now := time.Now().UTC()
	s.writeLearningLine(now, learninglog.RowSenseChanged(now, learninglog.SenseChangedParams{
		UserID:              userID,
		UWSID:               uwsID,
		WordSenseID:         oldWordSenseID,
		NewWordSenseID:      newWordSenseID,
		Lemma:               snap.Lemma,
		Definition:          snap.Definition,
		LocalizedDefinition: snap.LocalizedDefinition,
	}))
}

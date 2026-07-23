package words

import "project-pn/internal/enrich"

// SenseMatchInput is one sense candidate for auto-match remapping.
type SenseMatchInput struct {
	ID                  string
	Definition          string
	LocalizedDefinition string
	MeaningOrder        int
}

func senseBlob(s SenseMatchInput) string {
	return enrich.NormalizeMatchText(s.Definition + " " + s.LocalizedDefinition)
}

// AutoMatchSenseID returns the closest candidate ID for old, or "" if none.
// Score = TokenJaccard on definition+localized blobs; ties → lower MeaningOrder, then lexical ID.
func AutoMatchSenseID(old SenseMatchInput, candidates []SenseMatchInput) string {
	if len(candidates) == 0 {
		return ""
	}
	bestID := candidates[0].ID
	bestScore := enrich.TokenJaccard(senseBlob(old), senseBlob(candidates[0]))
	bestOrder := candidates[0].MeaningOrder
	for i := 1; i < len(candidates); i++ {
		c := candidates[i]
		score := enrich.TokenJaccard(senseBlob(old), senseBlob(c))
		if score > bestScore ||
			(score == bestScore && c.MeaningOrder < bestOrder) ||
			(score == bestScore && c.MeaningOrder == bestOrder && c.ID < bestID) {
			bestID, bestScore, bestOrder = c.ID, score, c.MeaningOrder
		}
	}
	return bestID
}

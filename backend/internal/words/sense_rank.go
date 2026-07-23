package words

import (
	"sort"
	"strings"

	"project-pn/internal/enrich"
)

// rankSenseOptions stable-sorts options by descending TokenJaccard against
// sourceContext (definition + localized_definition). Empty context is a no-op.
func rankSenseOptions(options []SenseOption, sourceContext string) {
	ctx := strings.TrimSpace(sourceContext)
	if ctx == "" || len(options) < 2 {
		return
	}
	type scored struct {
		idx   int
		score float64
	}
	scores := make([]scored, len(options))
	for i, o := range options {
		blob := o.Definition + " " + o.LocalizedDefinition
		scores[i] = scored{idx: i, score: enrich.TokenJaccard(ctx, blob)}
	}
	sort.SliceStable(scores, func(i, j int) bool {
		return scores[i].score > scores[j].score
	})
	reordered := make([]SenseOption, len(options))
	for i, s := range scores {
		reordered[i] = options[s.idx]
	}
	copy(options, reordered)
}

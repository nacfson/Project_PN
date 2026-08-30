package words

import (
	"sort"
	"strings"

	"project-pn/internal/enrich"
)

// rankSenseOptions scores options against sourceContext with TokenJaccard
// (definition + localized_definition) and stable-sorts by descending score.
// Empty context is a no-op and leaves Similarity unset.
func rankSenseOptions(options []SenseOption, sourceContext string) {
	ctx := strings.TrimSpace(sourceContext)
	if ctx == "" || len(options) == 0 {
		return
	}
	type scored struct {
		opt   SenseOption
		score float64
	}
	rows := make([]scored, len(options))
	for i, o := range options {
		blob := o.Definition + " " + o.LocalizedDefinition
		rows[i] = scored{opt: o, score: enrich.TokenJaccard(ctx, blob)}
	}
	if len(rows) >= 2 {
		sort.SliceStable(rows, func(i, j int) bool {
			return rows[i].score > rows[j].score
		})
	}
	for i, row := range rows {
		opt := row.opt
		score := row.score
		opt.Similarity = &score
		options[i] = opt
	}
}

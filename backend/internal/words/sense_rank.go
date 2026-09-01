package words

import (
	"sort"
	"strings"

	"project-pn/internal/enrich"
)

// English function words dropped from context ranking so they cannot tie
// or beat a sense that shares a distinctive content token (e.g. "the" in
// "electric charge" vs "battery" in a charging sentence).
var contextRankStopwords = []string{
	"the", "a", "an", "to", "of", "in", "on", "for", "and", "or",
	"is", "are", "was", "were", "be", "been", "being",
	"with", "by", "at", "from", "as", "that", "this", "it",
}

// rankSenseOptions scores options against sourceContext with TokenJaccard
// (definition + localized_definition) and stable-sorts by descending score.
// The lemma / normalized_text tokens and English stopwords are excluded so a
// definition that restates the headword ("electric charge") cannot outrank
// one that shares distinctive context words ("battery"). Empty context is a
// no-op and leaves Similarity unset. Stored meaning_order is not rewritten.
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
		exclude := append([]string{o.Lemma, o.NormalizedText}, contextRankStopwords...)
		rows[i] = scored{
			opt:   o,
			score: enrich.TokenJaccardExcluding(ctx, blob, exclude...),
		}
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

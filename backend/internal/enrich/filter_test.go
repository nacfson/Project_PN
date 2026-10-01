package enrich

import "testing"

func TestFilterProperSensesKeepsSimpleDistinctKoreanGloss(t *testing.T) {
	existing := []string{"to store energy", "충전하다"}
	incoming := []Sense{{
		Definition:            "to request payment",
		ShortDefinition:       "bill",
		NativeDefinition:      "청구하다",
		NativeShortDefinition: "청구하다",
	}}
	got := FilterProperSenses(existing, incoming, "ko", "charge")
	if len(got) != 1 {
		t.Fatalf("kept %d, want 1", len(got))
	}
	if got[0].NativeShortDefinition != "청구하다" {
		t.Fatalf("gloss=%q", got[0].NativeShortDefinition)
	}
}

func TestFilterProperSensesDropsEmptyParaphraseAndDuplicate(t *testing.T) {
	existing := []string{"to store energy", "충전하다"}
	incoming := []Sense{
		{Definition: "   "},
		{
			Definition:       "to store electrical energy",
			NativeDefinition: "무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다.",
		},
		{
			Definition:            "to store energy in a battery",
			NativeDefinition:      "충전하다",
			NativeShortDefinition: "충전하다",
		},
		{
			Definition:       "an English only filler",
			NativeDefinition: "",
		},
	}
	// The paraphrase extracts 감추다, which is simple and distinct — keep that case
	// in a dedicated assertion. Here drop empty, English-only, and near-dup of 충전하다.
	incoming[1].NativeDefinition = "to store energy in a long English paraphrase that is not Korean"
	got := FilterProperSenses(existing, incoming, "ko", "charge")
	if len(got) != 0 {
		t.Fatalf("expected all dropped, got %#v", got)
	}
}

func TestFilterProperSensesSimplifiesKoreanParaphrase(t *testing.T) {
	incoming := []Sense{{
		Definition:       "to bury",
		NativeDefinition: "무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다.",
	}}
	got := FilterProperSenses(nil, incoming, "ko", "bury")
	if len(got) != 1 {
		t.Fatalf("kept %d, want 1", len(got))
	}
	if got[0].NativeShortDefinition != "감추다" {
		t.Fatalf("gloss=%q", got[0].NativeShortDefinition)
	}
}

func TestFilterProperSensesKeepsPhraseUsagePattern(t *testing.T) {
	incoming := []Sense{{
		Definition:            "where",
		ShortDefinition:       "where",
		NativeDefinition:      "~하는 데",
		NativeShortDefinition: "~하는 데",
	}}
	got := FilterProperSenses(nil, incoming, "ko", "in which")
	if len(got) != 1 {
		t.Fatalf("kept %d, want 1 for phrase gloss", len(got))
	}
	if got[0].NativeShortDefinition != "~하는 데" {
		t.Fatalf("phrase gloss mangled: %q", got[0].NativeShortDefinition)
	}
}

func TestFilterProperSensesKeepsLeaveBehind(t *testing.T) {
	incoming := []Sense{{
		Definition:            "to abandon",
		ShortDefinition:       "abandon",
		NativeDefinition:      "남겨 두다",
		NativeShortDefinition: "남겨 두다",
	}}
	got := FilterProperSenses(nil, incoming, "ko", "leave behind")
	if len(got) != 1 {
		t.Fatalf("kept %d, want 1", len(got))
	}
	if got[0].NativeShortDefinition != "남겨 두다" {
		t.Fatalf("gloss=%q", got[0].NativeShortDefinition)
	}
}

// blunt-like: distinct English senses share the same simple KO headwords.
// DedupeSenses keeps all four; FilterProperSenses collapses to two cards.
func TestFilterProperSensesCollapsesBluntLikeSharedShortGlosses(t *testing.T) {
	incoming := []Sense{
		{
			Definition:            "having a dull edge or point",
			NativeDefinition:      "날이 무딘",
			NativeShortDefinition: "무딘",
		},
		{
			Definition:            "not sharp in feeling or perception",
			NativeDefinition:      "감각이 무딘",
			NativeShortDefinition: "무딘",
		},
		{
			Definition:            "abrupt or frank in manner",
			NativeDefinition:      "직설적인 말투의",
			NativeShortDefinition: "직설적인",
		},
		{
			Definition:            "direct and to the point without delicacy",
			NativeDefinition:      "매우 직설적인",
			NativeShortDefinition: "직설적인",
		},
	}
	if got := DedupeSenses(incoming); len(got) != 4 {
		t.Fatalf("DedupeSenses kept %d, want 4 (weak English/full-native Jaccard)", len(got))
	}
	got := FilterProperSenses(nil, incoming, "ko")
	if len(got) != 2 {
		t.Fatalf("FilterProperSenses kept %d, want 2 unique simple glosses; got %#v", len(got), got)
	}
	seen := map[string]bool{}
	for _, s := range got {
		seen[s.NativeShortDefinition] = true
	}
	if !seen["무딘"] || !seen["직설적인"] {
		t.Fatalf("expected 무딘 and 직설적인, got %#v", got)
	}
}

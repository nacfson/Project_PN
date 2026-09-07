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

package words

import "testing"

func TestAutoMatchSenseIDPicksClosest(t *testing.T) {
	old := SenseMatchInput{ID: "old", Definition: "deliberately", LocalizedDefinition: "고의로"}
	cands := []SenseMatchInput{
		{ID: "a", Definition: "to accuse", LocalizedDefinition: "기소하다", MeaningOrder: 1},
		{ID: "b", Definition: "intentionally; deliberately", LocalizedDefinition: "의도적으로", MeaningOrder: 2},
	}
	got := AutoMatchSenseID(old, cands)
	if got != "b" {
		t.Fatalf("got %q want b", got)
	}
}

func TestAutoMatchSenseIDTieBreakMeaningOrder(t *testing.T) {
	old := SenseMatchInput{ID: "old", Definition: "alpha beta", LocalizedDefinition: ""}
	cands := []SenseMatchInput{
		{ID: "z", Definition: "alpha beta", LocalizedDefinition: "", MeaningOrder: 2},
		{ID: "y", Definition: "alpha beta", LocalizedDefinition: "", MeaningOrder: 1},
	}
	if AutoMatchSenseID(old, cands) != "y" {
		t.Fatal("expected lower meaning_order")
	}
}

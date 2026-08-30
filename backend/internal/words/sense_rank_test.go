package words

import "testing"

func TestRankSenseOptionsOrdersByContext(t *testing.T) {
	options := []SenseOption{
		{WordSenseID: "accuse", Definition: "to accuse formally", LocalizedDefinition: "기소하다"},
		{WordSenseID: "battery", Definition: "to store energy in a battery", LocalizedDefinition: "충전하다"},
	}
	rankSenseOptions(options, "Please charge the battery overnight.")
	if options[0].WordSenseID != "battery" {
		t.Fatalf("expected battery first, got %q", options[0].WordSenseID)
	}
	if options[0].Similarity == nil || *options[0].Similarity <= *options[1].Similarity {
		t.Fatalf("expected battery similarity higher, got %v vs %v", options[0].Similarity, options[1].Similarity)
	}
}

func TestRankSenseOptionsSetsSimilarityForSingleOption(t *testing.T) {
	options := []SenseOption{
		{WordSenseID: "battery", Definition: "to store energy in a battery", LocalizedDefinition: "충전하다"},
	}
	rankSenseOptions(options, "Please charge the battery overnight.")
	if options[0].Similarity == nil || *options[0].Similarity == 0 {
		t.Fatalf("expected a positive similarity, got %v", options[0].Similarity)
	}
}

func TestRankSenseOptionsNoopWithoutContext(t *testing.T) {
	options := []SenseOption{
		{WordSenseID: "a", Definition: "alpha"},
		{WordSenseID: "b", Definition: "beta"},
	}
	rankSenseOptions(options, "")
	if options[0].WordSenseID != "a" {
		t.Fatal("order should be unchanged without context")
	}
	if options[0].Similarity != nil {
		t.Fatal("similarity must be unset without context")
	}
}

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
}

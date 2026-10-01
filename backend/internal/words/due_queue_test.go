package words

import "testing"

func cefr(level string) *string {
	return &level
}

func TestInterleaveDueItemsAvoidsConsecutiveSameWord(t *testing.T) {
	items := []DueItem{
		{WordID: "w1", CEFRLevel: cefr("A1"), Lemma: "run-1"},
		{WordID: "w1", CEFRLevel: cefr("A2"), Lemma: "run-2"},
		{WordID: "w2", CEFRLevel: cefr("A1"), Lemma: "go-1"},
		{WordID: "w2", CEFRLevel: cefr("A1"), Lemma: "go-2"},
	}

	got := interleaveDueItems(items)
	if len(got) != len(items) {
		t.Fatalf("expected %d items, got %d", len(items), len(got))
	}

	for i := 1; i < len(got); i++ {
		if got[i-1].WordID == got[i].WordID {
			t.Fatalf("consecutive same word at %d: %s then %s", i, got[i-1].Lemma, got[i].Lemma)
		}
	}
}

func TestShuffleAndInterleaveBreaksOriginOrder(t *testing.T) {
	items := []DueItem{
		{WordID: "w1", Lemma: "first"},
		{WordID: "w2", Lemma: "second"},
		{WordID: "w3", Lemma: "third"},
		{WordID: "w4", Lemma: "fourth"},
	}
	reverse := func(n int, swap func(i, j int)) {
		for i, j := 0, n-1; i < j; i, j = i+1, j-1 {
			swap(i, j)
		}
	}

	got := shuffleAndInterleaveDueItemsWith(items, reverse)
	if len(got) != len(items) {
		t.Fatalf("expected %d items, got %d", len(items), len(got))
	}
	if got[0].Lemma == "first" && got[1].Lemma == "second" && got[2].Lemma == "third" {
		t.Fatal("retry/due queue still follows origin order")
	}
	if got[0].Lemma != "fourth" || got[3].Lemma != "first" {
		t.Fatalf("expected reversed unique-word order, got %+v", lemmas(got))
	}
}

func TestShuffleAndInterleaveStillSeparatesSiblings(t *testing.T) {
	items := []DueItem{
		{WordID: "w1", Lemma: "run-1"},
		{WordID: "w1", Lemma: "run-2"},
		{WordID: "w2", Lemma: "go-1"},
		{WordID: "w2", Lemma: "go-2"},
	}
	identity := func(n int, swap func(i, j int)) {}

	got := shuffleAndInterleaveDueItemsWith(items, identity)
	for i := 1; i < len(got); i++ {
		if got[i-1].WordID == got[i].WordID {
			t.Fatalf("consecutive same word at %d: %s then %s", i, got[i-1].Lemma, got[i].Lemma)
		}
	}
}

func lemmas(items []DueItem) []string {
	out := make([]string, len(items))
	for i, item := range items {
		out[i] = item.Lemma
	}
	return out
}

func TestInterleaveDueItemsPreservesAllItems(t *testing.T) {
	items := []DueItem{
		{WordID: "w1", Lemma: "a"},
		{WordID: "w1", Lemma: "b"},
		{WordID: "w2", Lemma: "c"},
	}

	got := interleaveDueItems(items)
	if len(got) != 3 {
		t.Fatalf("expected 3 items, got %d", len(got))
	}

	seen := map[string]int{}
	for _, item := range got {
		seen[item.Lemma]++
	}
	for lemma, count := range seen {
		if count != 1 {
			t.Fatalf("lemma %q appeared %d times", lemma, count)
		}
	}
}

func TestClampDesiredRetention(t *testing.T) {
	if got := clampDesiredRetention(0.50); got != minDesiredRetention {
		t.Fatalf("expected clamp to min, got %f", got)
	}
	if got := clampDesiredRetention(0.99); got != maxDesiredRetention {
		t.Fatalf("expected clamp to max, got %f", got)
	}
	if got := clampDesiredRetention(0.88); got != 0.88 {
		t.Fatalf("expected 0.88 unchanged, got %f", got)
	}
}

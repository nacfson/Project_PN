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

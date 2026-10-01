package enrich

import "testing"

func TestIsSimpleGloss(t *testing.T) {
	simple := []string{"덮다", "사과", "노출하다", "떠나다, 버리다", "leave behind", "~하는 데", "~인 경우에", "~하는 방식으로"}
	for _, s := range simple {
		if !IsSimpleGloss(s) {
			t.Errorf("IsSimpleGloss(%q) = false, want true", s)
		}
	}
	complex := []string{
		"무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다.",
		"시체를 땅에 묻다",
		"To hide or conceal something by covering it",
		"흙이나 눈 등으로 ~을 덮다",
	}
	for _, s := range complex {
		if IsSimpleGloss(s) {
			t.Errorf("IsSimpleGloss(%q) = true, want false", s)
		}
	}
}

func TestExtractKoreanHeadword(t *testing.T) {
	cases := map[string]string{
		"흙이나 눈 등으로 ~을 덮다.":                    "덮다",
		"무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다.": "감추다",
		"시체를 땅에 묻다.":                            "묻다",
		"어떤 일에 몰두하다":                            "몰두하다",
	}
	for in, want := range cases {
		if got := ExtractKoreanHeadword(in); got != want {
			t.Errorf("ExtractKoreanHeadword(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestPreferSimpleGloss(t *testing.T) {
	if got := PreferSimpleGloss("덮다", "흙이나 눈 등으로 ~을 덮다"); got != "덮다" {
		t.Fatalf("kept simple short: got %q", got)
	}
	if got := PreferSimpleGloss("무엇을 덮어 감추다", "무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다."); got != "감추다" {
		t.Fatalf("korean extract: got %q", got)
	}
	got := PreferSimpleGloss(
		"To hide or conceal something by covering it with earth, snow, or other material.",
		"To cover something completely so that it cannot be seen.",
	)
	if got != "hide" {
		t.Fatalf("english infinitive: got %q", got)
	}
	if got := PreferSimpleGloss("~하는 데", "~하는 데"); got != "~하는 데" {
		t.Fatalf("phrase pattern kept: got %q", got)
	}
}

func TestFilterProperSensesKeepsPhrasePatternGloss(t *testing.T) {
	incoming := []Sense{{
		Definition:            "in which / where",
		ShortDefinition:       "where",
		NativeDefinition:      "~하는 데",
		NativeShortDefinition: "~하는 데",
	}}
	got := FilterProperSenses(nil, incoming, "ko")
	if len(got) != 1 {
		t.Fatalf("expected phrase gloss kept, got %d", len(got))
	}
	if got[0].NativeShortDefinition != "~하는 데" {
		t.Fatalf("NativeShortDefinition=%q", got[0].NativeShortDefinition)
	}
}

func TestPreferSimpleGlossForLemmaKeepsPhrasePattern(t *testing.T) {
	if got := PreferSimpleGlossForLemma("in which", "~하는 데", "관계대명사처럼 쓰이는 표현"); got != "~하는 데" {
		t.Fatalf("phrase short kept: got %q", got)
	}
	// Single-word lemma still extracts the last Hangul token.
	if got := PreferSimpleGlossForLemma("cover", "무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다.", ""); got != "감추다" {
		t.Fatalf("single-word extract: got %q", got)
	}
	if got := PreferSimpleGlossForLemma("leave behind", "남겨 두다", "뒤에 남겨 두다"); got != "남겨 두다" {
		t.Fatalf("leave behind: got %q", got)
	}
}

func TestIsSimplePhraseGloss(t *testing.T) {
	ok := []string{"~하는 데", "그곳에서", "~인 경우에", "남겨 두다", "where"}
	for _, s := range ok {
		if !IsSimplePhraseGloss(s) {
			t.Errorf("IsSimplePhraseGloss(%q) = false, want true", s)
		}
	}
	bad := []string{
		"무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다.",
		"To hide or conceal something by covering it",
	}
	for _, s := range bad {
		if IsSimplePhraseGloss(s) {
			t.Errorf("IsSimplePhraseGloss(%q) = true, want false", s)
		}
	}
}


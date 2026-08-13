package enrich

import "testing"

func TestValidTranslationKoreanRequiresHangul(t *testing.T) {
	if !ValidTranslation("ko", "to store energy", "충전하다") {
		t.Fatal("expected Korean Hangul translation to pass")
	}
	if ValidTranslation("ko", "to store energy", "to store energy") {
		t.Fatal("expected English copy of the source to fail Korean script check")
	}
	if ValidTranslation("ko", "to store energy", "") {
		t.Fatal("expected empty translation to fail")
	}
}

func TestValidTranslationJapaneseDoesNotAcceptHangul(t *testing.T) {
	if ValidTranslation("ja", "食べる", "먹다") {
		t.Fatal("Korean Hangul must not pass as a Japanese translation")
	}
	if !ValidTranslation("ja", "to eat", "食べる") {
		t.Fatal("expected Japanese translation to pass")
	}
}

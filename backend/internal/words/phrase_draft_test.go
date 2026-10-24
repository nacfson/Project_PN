package words

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"project-pn/internal/enrich"
	"project-pn/internal/learninglog"
)

func TestPhraseLookupFailsWhenEnrichFails(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	svc := New(pool, &stubEnricher{enrichErr: enrich.ErrUnavailable}, &fakeLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	lemma := fmt.Sprintf("look up %d", time.Now().UnixNano())
	pos := "phrase"
	_, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "Please look up the word.", &pos)
	if !errors.Is(err, enrich.ErrUnavailable) {
		t.Fatalf("expected ErrUnavailable when enricher fails on phrase, got %v", err)
	}
}

func TestSingleWordLookupStillFailsWhenEnrichFails(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	svc := New(pool, &stubEnricher{enrichErr: errors.New("down")}, &fakeLogger{}, learninglog.NoopLogger{}, "", "en", "ko")
	lemma := fmt.Sprintf("singlefail%d", time.Now().UnixNano())
	_, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "", nil)
	if err == nil {
		t.Fatal("single-word lookup must still fail without enricher")
	}
}

package words

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"project-pn/internal/admin"
	"project-pn/internal/enrich"
	"project-pn/internal/learninglog"
)

func learningLogTestService(t *testing.T, pool *pgxpool.Pool, logDir string) *Service {
	t.Helper()
	logger, err := learninglog.NewLogger(logDir)
	if err != nil {
		t.Fatalf("learning logger: %v", err)
	}
	t.Cleanup(func() { _ = logger.Close() })
	return New(pool, enrich.NewOpenAI("", ""), admin.NoopLogger{}, logger, "", "en", "ko")
}

func countLogLines(t *testing.T, logDir, substr string) int {
	t.Helper()
	name := learninglog.DailyFilename(time.Now().UTC())
	path := filepath.Join(logDir, name)
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return 0
		}
		t.Fatalf("read log: %v", err)
	}
	n := 0
	for _, line := range strings.Split(string(b), "\n") {
		if strings.Contains(line, substr) {
			n++
		}
	}
	return n
}

func TestAddLearningItemLogsOnce(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	userID, _ := deckTestUser(t, pool)
	logDir := t.TempDir()
	svc := learningLogTestService(t, pool, logDir)

	lemma := fmt.Sprintf("logadd%d", time.Now().UnixNano())
	senseID := insertDeckFixtureWord(t, pool, lemma)

	if _, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "ctx", ""); err != nil {
		t.Fatalf("first add: %v", err)
	}
	if _, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "ctx", ""); err != nil {
		t.Fatalf("second add: %v", err)
	}

	if got := countLogLines(t, logDir, "event=learning_item_added"); got != 1 {
		t.Fatalf("expected 1 learning_item_added line, got %d", got)
	}
}

func TestRecordBatchReviewLogsAttempt(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	userID, _ := deckTestUser(t, pool)
	logDir := t.TempDir()
	svc := learningLogTestService(t, pool, logDir)

	lemma := fmt.Sprintf("logrev%d", time.Now().UnixNano())
	senseID := insertDeckFixtureWord(t, pool, lemma)
	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "", "")
	if err != nil {
		t.Fatalf("add item: %v", err)
	}

	_, err = svc.RecordBatchReviewAttempts(ctx, userID, []ReviewAttemptParams{
		{
			UserWordSenseID: item.ID,
			ActivityType:    "cloze",
			IsCorrect:       false,
			RatingScore:     0.0,
		},
	})
	if err != nil {
		t.Fatalf("batch review: %v", err)
	}

	if got := countLogLines(t, logDir, "event=review_attempted"); got != 1 {
		t.Fatalf("expected 1 review_attempted line, got %d", got)
	}
}

func TestReviewSucceedsWhenLearningLogDisabled(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	userID, _ := deckTestUser(t, pool)
	svc := New(pool, enrich.NewOpenAI("", ""), admin.NoopLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	lemma := fmt.Sprintf("nooplog%d", time.Now().UnixNano())
	senseID := insertDeckFixtureWord(t, pool, lemma)
	item, err := svc.AddLearningItem(ctx, userID, senseID, "ko", "", "", "")
	if err != nil {
		t.Fatalf("add: %v", err)
	}

	_, err = svc.RecordBatchReviewAttempts(ctx, userID, []ReviewAttemptParams{
		{UserWordSenseID: item.ID, ActivityType: "word_to_meaning", IsCorrect: true, RatingScore: 2.0},
	})
	if err != nil {
		t.Fatalf("review with noop logger: %v", err)
	}
}

func TestChangeSenseLogsEvent(t *testing.T) {
	pool := deckTestPool(t)
	ctx := context.Background()
	userID, _ := deckTestUser(t, pool)
	logDir := t.TempDir()
	svc := learningLogTestService(t, pool, logDir)

	lemma := fmt.Sprintf("logsense%d", time.Now().UnixNano())
	var wordID string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'verb') returning id::text`, lemma).Scan(&wordID); err != nil {
		t.Fatal(err)
	}
	var senseA, senseB string
	for i, def := range []string{"meaning a", "meaning b"} {
		var id string
		if err := pool.QueryRow(ctx, `
			insert into word_senses (word_id, definition, meaning_order)
			values ($1::uuid, $2, $3) returning id::text`, wordID, def, i+1).Scan(&id); err != nil {
			t.Fatal(err)
		}
		if i == 0 {
			senseA = id
		} else {
			senseB = id
		}
		_, _ = pool.Exec(ctx, `
			insert into sense_translations (word_sense_id, language_code, definition)
			values ($1::uuid, 'ko', $2)`, id, def+" ko")
	}

	item, err := svc.AddLearningItem(ctx, userID, senseA, "ko", "", "", "")
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	if _, err := svc.ChangeLearningItemSense(ctx, userID, item.ID, senseB, "ko", nil); err != nil {
		t.Fatalf("change sense: %v", err)
	}

	if got := countLogLines(t, logDir, "event=sense_changed"); got != 1 {
		t.Fatalf("expected 1 sense_changed line, got %d", got)
	}
}

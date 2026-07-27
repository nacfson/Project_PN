# Learning Daily Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Append key=value learning analytics rows to UTC daily files (`YYYYMMDD_log`) from the Go backend when users add learning items and complete reviews, for offline pipeline aggregation.

**Architecture:** New `internal/learninglog` package (noop + daily file writer + row encoder) mirrors `internal/admin` patterns. `words.Service` receives a `learninglog.Logger` and emits events after successful DB commits. No schema migrations, no new HTTP routes, no frontend changes.

**Tech Stack:** Go 1.26, PostgreSQL via pgx/v5, existing `words.Service` review/add flows.

## Global Constraints

- No new PostgreSQL tables or migrations.
- Daily files: `{LEARNING_LOG_DIR}/YYYYMMDD_log` (UTC date from event `ts`).
- Row format: space-separated `key=value`; `ts` then `event` first; booleans `true`/`false`; omit `response_time_ms` when null.
- `LEARNING_LOG_DIR` empty → learning logs disabled (noop logger).
- Log write failures must **not** fail HTTP or review transactions; warn with `log/slog` only.
- Do not log emails, IPs, tokens, prompts, or user answers.
- Separate from `admin.log`; do not change admin log format.
- Directory mode `0750`, file mode `0640`.
- Follow existing `words.New(...)` and handler test patterns (`fakeLogger`, `validationRouterWithLogger`).

---

## File Map

| File | Responsibility |
|------|----------------|
| `backend/internal/config/config.go` | `LearningLogDir string` from `LEARNING_LOG_DIR`. |
| `backend/internal/config/config_test.go` | Default empty; env override test. |
| `backend/internal/learninglog/encode.go` | `QuoteValue`, `FormatRow` with fixed key order per event. |
| `backend/internal/learninglog/encode_test.go` | Quoting, escapes, key order. |
| `backend/internal/learninglog/logger.go` | `Logger` interface, `NoopLogger`, `FileLogger` (daily append, mutex, recover). |
| `backend/internal/learninglog/logger_test.go` | Daily filename, concurrent append, noop when path empty. |
| `backend/internal/learninglog/events.go` | Typed helpers building rows for each event name. |
| `backend/internal/learninglog/events_test.go` | Golden-line tests per event. |
| `backend/cmd/api/main.go` | Construct learning logger from config; pass to `words.New`. |
| `backend/internal/words/service.go` | `learningLogger` field; `AddLearningItem` insert detection + log; sense snapshot helper. |
| `backend/internal/words/batch_reviews.go` | Collect post-commit review/archive log payloads; emit after commit. |
| `backend/internal/words/change_sense_log.go` | `emitSenseChanged` helper (keeps `service.go` smaller). |
| `backend/internal/words/learning_log_test.go` | Service-level tests for add + review emit. |
| `backend/internal/http/words_handler_test.go` | Optional: read daily log file after batch review HTTP test. |
| `backend/.env.example` | Document `LEARNING_LOG_DIR`. |
| `backend/docs/go-backend-setup.md` | One paragraph on learning daily logs + env var. |

---

### Task 1: `LEARNING_LOG_DIR` configuration

**Files:**
- Modify: `backend/internal/config/config.go`
- Modify: `backend/internal/config/config_test.go`

**Interfaces:**
- Consumes: none.
- Produces: `Config.LearningLogDir string` — empty when unset (learning logs off).

- [ ] **Step 1: Write the failing tests**

Add to `backend/internal/config/config_test.go`:

```go
func TestLoad_LearningLogDirDefaultEmpty(t *testing.T) {
	t.Setenv("LEARNING_LOG_DIR", "")
	cfg := Load()
	if cfg.LearningLogDir != "" {
		t.Fatalf("expected empty learning log dir by default, got %q", cfg.LearningLogDir)
	}
}

func TestLoad_LearningLogDirFromEnv(t *testing.T) {
	t.Setenv("LEARNING_LOG_DIR", "/tmp/pn-learning")
	cfg := Load()
	if cfg.LearningLogDir != "/tmp/pn-learning" {
		t.Fatalf("expected env learning log dir, got %q", cfg.LearningLogDir)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && go test ./internal/config -run TestLoad_LearningLogDir -v
```

Expected: FAIL — `LearningLogDir` undefined.

- [ ] **Step 3: Add config field**

In `backend/internal/config/config.go`:

1. Add to `Config`:
```go
LearningLogDir string
```

2. In `Load()`:
```go
LearningLogDir: os.Getenv("LEARNING_LOG_DIR"),
```

(No default path — empty disables logging per spec.)

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && go test ./internal/config -run TestLoad_LearningLogDir -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/config/config.go backend/internal/config/config_test.go
git commit -m "config: add LEARNING_LOG_DIR for daily learning logs"
```

---

### Task 2: Key=value row encoder

**Files:**
- Create: `backend/internal/learninglog/encode.go`
- Create: `backend/internal/learninglog/encode_test.go`

**Interfaces:**
- Consumes: none.
- Produces:
  - `func QuoteValue(s string) string`
  - `func FormatRow(ts time.Time, event string, fields [][2]string) string` — appends fields in slice order after `ts` and `event`.

- [ ] **Step 1: Write the failing tests**

Create `backend/internal/learninglog/encode_test.go`:

```go
package learninglog

import (
	"strings"
	"testing"
	"time"
)

func TestQuoteValue(t *testing.T) {
	tests := []struct {
		in, want string
	}{
		{"charge", "charge"},
		{"en-ko", "en-ko"},
		{"to ask someone to pay", `"to ask someone to pay"`},
		{`say "hi"`, `"say \"hi\""`},
	}
	for _, tc := range tests {
		if got := QuoteValue(tc.in); got != tc.want {
			t.Fatalf("QuoteValue(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestFormatRowFixedOrder(t *testing.T) {
	ts := time.Date(2026, 7, 26, 9, 12, 3, 0, time.UTC)
	row := FormatRow(ts, "learning_item_added", [][2]string{
		{"user_id", "u1"},
		{"lemma", "charge"},
	})
	if !strings.HasPrefix(row, "ts=2026-07-26T09:12:03Z event=learning_item_added ") {
		t.Fatalf("unexpected prefix: %q", row)
	}
	if !strings.Contains(row, "user_id=u1 lemma=charge") {
		t.Fatalf("expected ordered tail, got %q", row)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && go test ./internal/learninglog -run 'TestQuoteValue|TestFormatRow' -v
```

Expected: FAIL — package or symbols missing.

- [ ] **Step 3: Implement encoder**

Create `backend/internal/learninglog/encode.go`:

```go
package learninglog

import (
	"strings"
	"time"
	"unicode"
)

var safeValue = func(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '.' || r == ':' || r == '-'
}

func QuoteValue(s string) string {
	if s == "" {
		return `""`
	}
	for _, r := range s {
		if !safeValue(r) {
			return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(s) + `"`
		}
	}
	return s
}

func FormatRow(ts time.Time, event string, fields [][2]string) string {
	parts := make([]string, 0, 2+len(fields))
	parts = append(parts, "ts="+ts.UTC().Format(time.RFC3339))
	parts = append(parts, "event="+QuoteValue(event))
	for _, kv := range fields {
		parts = append(parts, kv[0]+"="+QuoteValue(kv[1]))
	}
	return strings.Join(parts, " ")
}
```

- [ ] **Step 4: Run tests**

Run:
```bash
cd backend && go test ./internal/learninglog -run 'TestQuoteValue|TestFormatRow' -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/learninglog/encode.go backend/internal/learninglog/encode_test.go
git commit -m "feat(learninglog): add key=value row encoder"
```

---

### Task 3: Daily file logger

**Files:**
- Create: `backend/internal/learninglog/logger.go`
- Create: `backend/internal/learninglog/logger_test.go`

**Interfaces:**
- Consumes: `FormatRow`.
- Produces:
  - `type Logger interface { WriteLine(ts time.Time, line string); Close() error }`
  - `func NewLogger(dir string) (Logger, error)` — empty dir → `NoopLogger{}`.
  - `func DailyFilename(ts time.Time) string` → `YYYYMMDD_log`.

- [ ] **Step 1: Write failing tests**

Create `backend/internal/learninglog/logger_test.go` with:

```go
func TestDailyFilenameUTC(t *testing.T) {
	ts := time.Date(2026, 7, 26, 23, 59, 0, 0, time.FixedZone("KST", 9*3600))
	// ts in KST is still 2026-07-26 14:59 UTC → file 20260726_log
	if got := DailyFilename(ts); got != "20260726_log" {
		t.Fatalf("got %q", got)
	}
}

func TestFileLogger_AppendsToDailyFile(t *testing.T) {
	dir := t.TempDir()
	logger, err := NewLogger(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer logger.Close()
	ts := time.Date(2026, 7, 26, 10, 0, 0, 0, time.UTC)
	logger.WriteLine(ts, "ts=2026-07-26T10:00:00Z event=review_attempted user_id=u1")
	path := filepath.Join(dir, "20260726_log")
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(b), "event=review_attempted") {
		t.Fatalf("file contents: %q", b)
	}
}

func TestNewLoggerEmptyDirIsNoop(t *testing.T) {
	logger, err := NewLogger("")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := logger.(NoopLogger); !ok {
		t.Fatalf("expected NoopLogger, got %T", logger)
	}
}
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && go test ./internal/learninglog -run 'TestDailyFilename|TestFileLogger|TestNewLoggerEmpty' -v
```

- [ ] **Step 3: Implement logger**

Create `backend/internal/learninglog/logger.go` (mirror `admin.FileLogger`):

```go
package learninglog

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Logger interface {
	WriteLine(ts time.Time, line string)
	Close() error
}

type NoopLogger struct{}

func (NoopLogger) WriteLine(time.Time, string) {}
func (NoopLogger) Close() error                { return nil }

type FileLogger struct {
	mu  sync.Mutex
	dir string
}

func NewLogger(dir string) (Logger, error) {
	if dir == "" {
		return NoopLogger{}, nil
	}
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return NoopLogger{}, fmt.Errorf("learning log: mkdir: %w", err)
	}
	return &FileLogger{dir: dir}, nil
}

func DailyFilename(ts time.Time) string {
	u := ts.UTC()
	return u.Format("20060102") + "_log"
}

func (l *FileLogger) WriteLine(ts time.Time, line string) {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("learning log: panic recovered", "panic", r)
		}
	}()
	l.mu.Lock()
	defer l.mu.Unlock()
	path := filepath.Join(l.dir, DailyFilename(ts))
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o640)
	if err != nil {
		slog.Error("learning log: open file", "error", err, "path", path)
		return
	}
	defer f.Close()
	if _, err := fmt.Fprintf(f, "%s\n", line); err != nil {
		slog.Error("learning log: write line", "error", err, "path", path)
	}
}

func (l *FileLogger) Close() error { return nil }

var _ Logger = NoopLogger{}
var _ Logger = (*FileLogger)(nil)
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && go test ./internal/learninglog/... -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/internal/learninglog/logger.go backend/internal/learninglog/logger_test.go
git commit -m "feat(learninglog): append rows to UTC daily files"
```

---

### Task 4: Event row builders

**Files:**
- Create: `backend/internal/learninglog/events.go`
- Create: `backend/internal/learninglog/events_test.go`

**Interfaces:**
- Consumes: `FormatRow`, `QuoteValue`.
- Produces:
  - `func RowLearningItemAdded(ts time.Time, p LearningItemAddedParams) string`
  - `func RowReviewAttempted(ts time.Time, p ReviewAttemptedParams) string`
  - `func RowSenseChanged(ts time.Time, p SenseChangedParams) string`
  - `func RowLearningItemArchived(ts time.Time, p LearningItemArchivedParams) string`

Define param structs with string/bool fields; `ReviewAttemptedParams` uses `ResponseTimeMs *int` — omit key when nil.

- [ ] **Step 1: Write failing test for review row omitting response_time**

```go
func TestRowReviewAttemptedOmitsNullResponseTime(t *testing.T) {
	ts := time.Date(2026, 7, 26, 9, 15, 44, 0, time.UTC)
	row := RowReviewAttempted(ts, ReviewAttemptedParams{
		UserID: "u1", UWSID: "w1", WordSenseID: "s1", Lemma: "charge",
		ActivityType: "cloze", Rating: "again", IsCorrect: false,
		LearningStage: "learning", FSRSState: "Learning",
		Difficulty: "7.2", Stability: "1.4", Leech: false,
	})
	if strings.Contains(row, "response_time_ms") {
		t.Fatalf("should omit null response_time_ms: %q", row)
	}
}
```

- [ ] **Step 2: Run — FAIL**

```bash
cd backend && go test ./internal/learninglog -run TestRowReviewAttemptedOmits -v
```

- [ ] **Step 3: Implement events.go**

Use fixed field order matching spec:

**learning_item_added:** `user_id`, `uws_id`, `word_sense_id`, `lemma`, `pos`, `definition`, `localized_definition`, `lang_pair`, `source_context`

**review_attempted:** `user_id`, `uws_id`, `word_sense_id`, `lemma`, `activity_type`, `rating`, `is_correct`, optional `response_time_ms`, `learning_stage`, `fsrs_state`, `difficulty`, `stability`, `leech`

**sense_changed:** `user_id`, `uws_id`, `word_sense_id`, `new_word_sense_id`, `lemma`, `definition`, `localized_definition`

**learning_item_archived:** `user_id`, `uws_id`, `word_sense_id`, `lemma`

Format floats as `%g` or fixed decimal strings in params before `FormatRow`.

- [ ] **Step 4: Run all learninglog tests**

```bash
cd backend && go test ./internal/learninglog/... -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/learninglog/events.go backend/internal/learninglog/events_test.go
git commit -m "feat(learninglog): add event row builders"
```

---

### Task 5: Wire logger into API main and words.Service

**Files:**
- Modify: `backend/cmd/api/main.go`
- Modify: `backend/internal/words/service.go`
- Modify: all `words.New(...)` call sites (grep `words.New(`)

**Interfaces:**
- Consumes: `learninglog.NewLogger`, `config.Config.LearningLogDir`.
- Produces: `words.New(..., learningLogger learninglog.Logger, ...)` with new parameter after `adminLogger`.

- [ ] **Step 1: Extend Service struct and constructor**

In `service.go`:

```go
learningLogger learninglog.Logger

func New(pool *pgxpool.Pool, enricher enrich.Enricher, adminLogger admin.Logger, learningLogger learninglog.Logger, defaultUserID, targetLang, definitionLang string) *Service {
	return &Service{
		// ...
		learningLogger: learningLogger,
	}
}

func (s *Service) writeLearningLine(ts time.Time, line string) {
	if s.learningLogger == nil {
		return
	}
	s.learningLogger.WriteLine(ts, line)
}
```

- [ ] **Step 2: Update main.go**

```go
learningLogger, err := learninglog.NewLogger(cfg.LearningLogDir)
if err != nil {
	slog.Warn("learning logger disabled", "error", err)
}
defer learningLogger.Close()

wordsService := words.New(pool, enricher, adminLogger, learningLogger, cfg.DefaultUserID, cfg.DefaultTargetLang, cfg.DefaultDefinitionLang)
```

- [ ] **Step 3: Fix compile errors**

Run:
```bash
cd backend && go test ./... 2>&1 | head -40
```

Update every `words.New(...)` to insert `learninglog.NoopLogger{}` (or `admin.NoopLogger{}` position — insert learning logger as 4th arg). Files include at minimum:
- `backend/internal/http/*_test.go`
- `backend/cmd/retranslate-senses/main.go`

- [ ] **Step 4: Commit**

```bash
git add backend/cmd/api/main.go backend/internal/words/service.go backend/internal/http backend/cmd/retranslate-senses
git commit -m "feat(words): inject learning daily log logger"
```

---

### Task 6: Log `learning_item_added` on new inserts only

**Files:**
- Modify: `backend/internal/words/service.go` (`AddLearningItem`)
- Create: `backend/internal/words/sense_log_snapshot.go` (helper query)
- Test: `backend/internal/words/learning_log_test.go`

**Interfaces:**
- Consumes: `RowLearningItemAdded`, `writeLearningLine`.
- Produces: `func (s *Service) senseLogSnapshot(ctx context.Context, wordSenseID, displayLang string) (senseLogSnapshot, error)`

- [ ] **Step 1: Write failing test**

In `learning_log_test.go`, use temp dir + real `learninglog.NewLogger`, call `AddLearningItem` twice for same sense; assert log file has exactly one `learning_item_added` line.

- [ ] **Step 2: Run — FAIL**

```bash
cd backend && go test ./internal/words -run TestAddLearningItemLogsOnce -v
```

- [ ] **Step 3: Detect insert in upsert**

Change `AddLearningItem` upsert `RETURNING` to include PostgreSQL insert flag:

```sql
returning id::text, word_sense_id::text, learning_stage, (xmax = 0) as inserted
```

Scan into `var inserted bool`. After successful `tx.Commit`, if `inserted`:

1. `snap, err := s.senseLogSnapshot(ctx, wordSenseID, displayLang)`
2. `langPair := wordLang + "-" + displayLang`
3. `now := time.Now().UTC()`
4. `s.writeLearningLine(now, learninglog.RowLearningItemAdded(now, learninglog.LearningItemAddedParams{...}))`

Implement `senseLogSnapshot` query:

```sql
select w.normalized_text,
       coalesce(w.part_of_speech, ''),
       ws.definition,
       coalesce(st.definition, ws.definition)
from word_senses ws
join words w on w.id = ws.word_id
left join sense_translations st
  on st.word_sense_id = ws.id and st.language_code = $2
where ws.id = $1::uuid
```

- [ ] **Step 4: Run test — PASS**

```bash
cd backend && go test ./internal/words -run TestAddLearningItemLogsOnce -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/internal/words/service.go backend/internal/words/sense_log_snapshot.go backend/internal/words/learning_log_test.go
git commit -m "feat(words): log learning_item_added for new user_word_senses rows"
```

---

### Task 7: Log `review_attempted` (and leech archive) after batch commit

**Files:**
- Modify: `backend/internal/words/batch_reviews.go`

**Interfaces:**
- Consumes: `RowReviewAttempted`, `RowLearningItemArchived`, `writeLearningLine`.
- Produces: internal type `pendingLearningLog struct { ts time.Time; line string }` collected during loop, flushed after `tx.Commit`.

- [ ] **Step 1: Write failing test**

Extend `learning_log_test.go`: seed user + item, call `RecordBatchReviewAttempts` with one attempt (`rating_score` → `again`), read daily log, assert one `review_attempted` with `rating=again`.

- [ ] **Step 2: Run — FAIL**

```bash
cd backend && go test ./internal/words -run TestRecordBatchReviewLogsAttempt -v
```

- [ ] **Step 3: Extend review state SELECT**

In the batch loop query, also select:

```sql
uws.word_sense_id::text,
w.normalized_text as lemma
```

Join `word_senses ws` and `words w` on `uws.word_sense_id`.

After computing `nextState`, `reviewRating`, `nextStage`, `isLeech`, append to `pending`:

```go
pending = append(pending, pendingLearningLog{
	ts: now,
	line: learninglog.RowReviewAttempted(now, learninglog.ReviewAttemptedParams{
		UserID: userID,
		UWSID: uwsID,
		WordSenseID: wordSenseID,
		Lemma: lemma,
		ActivityType: attempt.ActivityType,
		Rating: reviewRating,
		IsCorrect: attempt.IsCorrect,
		ResponseTimeMs: attempt.ResponseTimeMs,
		LearningStage: nextStage,
		FSRSState: nextState.State,
		Difficulty: fmt.Sprintf("%g", nextState.Difficulty),
		Stability: fmt.Sprintf("%g", nextState.Stability),
		Leech: isLeech,
	}),
})
if suspendCard {
	pending = append(pending, pendingLearningLog{
		ts: now,
		line: learninglog.RowLearningItemArchived(now, ...),
	})
}
```

After successful `tx.Commit`:

```go
for _, p := range pending {
	s.writeLearningLine(p.ts, p.line)
}
```

- [ ] **Step 4: Run test — PASS**

```bash
cd backend && go test ./internal/words -run TestRecordBatchReviewLogsAttempt -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/internal/words/batch_reviews.go backend/internal/words/learning_log_test.go
git commit -m "feat(words): log review_attempted after batch review commit"
```

---

### Task 8: Log `sense_changed`

**Files:**
- Create: `backend/internal/words/change_sense_log.go`
- Modify: `backend/internal/words/service.go` (`ChangeLearningItemSense` — call helper before return)
- Test: `backend/internal/words/learning_log_test.go`

- [ ] **Step 1: Failing test** — change sense, assert log line contains `event=sense_changed` and `new_word_sense_id=`.

- [ ] **Step 2: Implement** — after successful update, load snapshot for old and new sense (lemma same word), emit one row with old `word_sense_id` and `new_word_sense_id`.

- [ ] **Step 3: Run**

```bash
cd backend && go test ./internal/words -run TestChangeSenseLogsEvent -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/words/change_sense_log.go backend/internal/words/service.go backend/internal/words/learning_log_test.go
git commit -m "feat(words): log sense_changed for learning item remounts"
```

---

### Task 9: Logger failure does not break reviews

**Files:**
- Modify: `backend/internal/words/learning_log_test.go`

- [ ] **Step 1: Add `errorLogger` test double** in test file that panics or no-ops — actually spec requires write failure must not fail request; `FileLogger` already swallows errors. Add test documenting behavior: set `LEARNING_LOG_DIR` to a file path (not directory) so mkdir/open fails → `NewLogger` returns noop; `RecordBatchReviewAttempts` still succeeds.

- [ ] **Step 2: Run**

```bash
cd backend && go test ./internal/words -run TestReviewSucceedsWhenLearningLogDisabled -v
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/words/learning_log_test.go
git commit -m "test(words): reviews succeed when learning log is disabled"
```

---

### Task 10: Documentation

**Files:**
- Modify: `backend/.env.example`
- Modify: `backend/docs/go-backend-setup.md`

- [ ] **Step 1: Add to `.env.example`**

```bash
# Daily learning analytics log directory (YYYYMMDD_log files). Empty disables.
LEARNING_LOG_DIR=
```

- [ ] **Step 2: Add short section to go-backend-setup.md** — path pattern, row format pointer to `docs/superpowers/specs/2026-07-27-learning-daily-log-design.md`, note separate from `ADMIN_LOG_PATH`.

- [ ] **Step 3: Commit**

```bash
git add backend/.env.example backend/docs/go-backend-setup.md
git commit -m "docs: document LEARNING_LOG_DIR daily analytics logs"
```

---

### Task 11: Full backend verification

- [ ] **Step 1: Run full test suite**

```bash
cd backend && go test ./... -count=1
```

Expected: all PASS.

- [ ] **Step 2: Manual smoke (optional)**

```bash
export LEARNING_LOG_DIR=/tmp/pn-learning-test
# run API, add one word, complete one review
tail -1 /tmp/pn-learning-test/$(date -u +%Y%m%d)_log
```

Expected: key=value row with `event=review_attempted` or `learning_item_added`.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| Daily `YYYYMMDD_log` UTC files | Task 3 |
| key=value rows, quoting rules | Task 2, 4 |
| `learning_item_added` on new row only | Task 6 |
| `review_attempted` after DB commit | Task 7 |
| `sense_changed` optional | Task 8 |
| `learning_item_archived` on leech suspend | Task 7 |
| No prompt/answer/email in logs | Task 4 (fields only) |
| Write failure must not fail requests | Task 3, 9 |
| `LEARNING_LOG_DIR` empty disables | Task 1, 3 |
| No DB migrations | (none) |
| Tests | Tasks 2–9, 11 |

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-27-learning-daily-log.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — run tasks in this session with executing-plans, batch execution with checkpoints

Which approach?

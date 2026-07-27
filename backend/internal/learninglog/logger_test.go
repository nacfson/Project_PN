package learninglog

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestDailyFilenameUTC(t *testing.T) {
	ts := time.Date(2026, 7, 26, 23, 59, 0, 0, time.FixedZone("KST", 9*3600))
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

func TestFileLogger_ConcurrentAppend(t *testing.T) {
	dir := t.TempDir()
	logger, err := NewLogger(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer logger.Close()
	ts := time.Date(2026, 7, 26, 11, 0, 0, 0, time.UTC)
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			logger.WriteLine(ts, "line")
		}(i)
	}
	wg.Wait()
	path := filepath.Join(dir, "20260726_log")
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Count(string(b), "line\n") != 20 {
		t.Fatalf("expected 20 lines, got %q", b)
	}
}

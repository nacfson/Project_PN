package admin

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestNewLogger_EmptyPath_ReturnsNoop(t *testing.T) {
	logger, err := NewLogger("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := logger.(NoopLogger); !ok {
		t.Fatalf("expected NoopLogger, got %T", logger)
	}
}

func TestFileLogger_Log(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "admin.log")
	logger, err := NewLogger(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer logger.Close()

	logger.Log("AUTH", "user logged in")
	logger.Logf("METRICS", "last %ds: %d requests", 60, 42)

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read log: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) != 2 {
		t.Fatalf("expected 2 lines, got %d", len(lines))
	}
	if !strings.Contains(lines[0], "[AUTH] user logged in") {
		t.Fatalf("unexpected first line: %s", lines[0])
	}
	if !strings.Contains(lines[1], "[METRICS] last 60s: 42 requests") {
		t.Fatalf("unexpected second line: %s", lines[1])
	}
}

func TestFileLogger_Concurrent(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "admin.log")
	logger, err := NewLogger(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer logger.Close()

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			logger.Logf("CONC", "entry %d", i)
		}(i)
	}
	wg.Wait()

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read log: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) != 100 {
		t.Fatalf("expected 100 lines, got %d", len(lines))
	}
}

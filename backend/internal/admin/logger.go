package admin

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Logger emits one-line admin audit logs.
type Logger interface {
	Log(category, message string)
	Logf(category, format string, args ...interface{})
	Close() error
}

// NoopLogger discards all log output.
type NoopLogger struct{}

func (NoopLogger) Log(string, string)                   {}
func (NoopLogger) Logf(string, string, ...interface{}) {}
func (NoopLogger) Close() error                         { return nil }

// FileLogger writes timestamped lines to a file.
type FileLogger struct {
	mu sync.Mutex
	w  io.WriteCloser
}

// NewLogger creates a Logger. An empty path returns a NoopLogger.
func NewLogger(path string) (Logger, error) {
	if path == "" {
		return NoopLogger{}, nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0750); err != nil {
		return NoopLogger{}, fmt.Errorf("admin log: create directory: %w", err)
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0640)
	if err != nil {
		return NoopLogger{}, fmt.Errorf("admin log: open file: %w", err)
	}
	return &FileLogger{w: f}, nil
}

func (l *FileLogger) Log(category, message string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	ts := time.Now().UTC().Format(time.RFC3339)
	if _, err := fmt.Fprintf(l.w, "%s [%s] %s\n", ts, category, message); err != nil {
		slog.Error("admin log: failed to write audit log", "error", err, "category", category)
	}
}

func (l *FileLogger) Logf(category, format string, args ...interface{}) {
	l.Log(category, fmt.Sprintf(format, args...))
}

func (l *FileLogger) Close() error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.w == nil {
		return nil
	}
	return l.w.Close()
}

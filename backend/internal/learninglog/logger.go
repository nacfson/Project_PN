package learninglog

import (
	"fmt"
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

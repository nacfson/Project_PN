package admin

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"sync"
	"time"

	"project-pn/internal/logx"
)

// Logger emits one JSON admin audit line per event.
type Logger interface {
	Log(category, message string)
	Logf(category, format string, args ...interface{})
	Close() error
}

// NoopLogger discards all log output.
type NoopLogger struct{}

func (NoopLogger) Log(string, string)                  {}
func (NoopLogger) Logf(string, string, ...interface{}) {}
func (NoopLogger) Close() error                        { return nil }

type auditLine struct {
	Time           string `json:"time"`
	Level          string `json:"level"`
	Msg            string `json:"msg"`
	ServiceName    string `json:"service.name"`
	ServiceVersion string `json:"service.version"`
	EventName      string `json:"event.name"`
	Category       string `json:"category"`
}

// streamLogger writes audit lines to a writer. Close does not close the writer,
// so the process stderr stays open.
type streamLogger struct {
	mu sync.Mutex
	w  io.Writer
}

// NewLogger writes admin audit JSON to stderr. It does not open a file.
func NewLogger() Logger {
	return &streamLogger{w: os.Stderr}
}

// NewWriterLogger writes admin audit JSON to w. A nil writer is a no-op.
func NewWriterLogger(w io.Writer) Logger {
	if w == nil {
		return NoopLogger{}
	}
	return &streamLogger{w: w}
}

func (l *streamLogger) Log(category, message string) {
	defer func() {
		if rec := recover(); rec != nil {
			slog.Error("admin log: panic recovered", "panic", rec, "category", category)
		}
	}()
	l.mu.Lock()
	defer l.mu.Unlock()
	rec := auditLine{
		Time:           time.Now().UTC().Format(logx.TimeFormat),
		Level:          "info",
		Msg:            message,
		ServiceName:    logx.Service(),
		ServiceVersion: logx.Version(),
		EventName:      "admin",
		Category:       category,
	}
	b, err := json.Marshal(rec)
	if err != nil {
		slog.Error("admin log: marshal", "error", err, "category", category)
		return
	}
	b = append(b, '\n')
	if _, err := l.w.Write(b); err != nil {
		slog.Error("admin log: write", "error", err, "category", category)
	}
}

func (l *streamLogger) Logf(category, format string, args ...interface{}) {
	l.Log(category, fmt.Sprintf(format, args...))
}

func (l *streamLogger) Close() error { return nil }

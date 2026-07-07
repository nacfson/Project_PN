package admin

import (
	"fmt"
	"testing"
)

type fakeLogger struct {
	logs []string
}

func (f *fakeLogger) Log(category, message string) {
	f.logs = append(f.logs, category+": "+message)
}

func (f *fakeLogger) Logf(category, format string, args ...interface{}) {
	f.Log(category, fmt.Sprintf(format, args...))
}

func (f *fakeLogger) Close() error { return nil }

func TestMetricsCollector_Flush(t *testing.T) {
	col := NewMetricsCollector()
	col.RecordRequest(200, 40, "user-1")
	col.RecordRequest(500, 120, "user-2")
	col.RecordRequest(200, 20, "user-1")

	logger := &fakeLogger{}
	col.Flush(logger)

	if len(logger.logs) != 1 {
		t.Fatalf("expected 1 log, got %d", len(logger.logs))
	}
	expected := "METRICS: last 60s: 3 requests, 1 errors, avg latency 60ms, 2 active users"
	if logger.logs[0] != expected {
		t.Fatalf("expected %q, got %q", expected, logger.logs[0])
	}
}

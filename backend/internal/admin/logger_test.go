package admin

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"
)

func TestNewWriterLogger_NilIsNoop(t *testing.T) {
	logger := NewWriterLogger(nil)
	if _, ok := logger.(NoopLogger); !ok {
		t.Fatalf("expected NoopLogger, got %T", logger)
	}
}

func TestStreamLogger_WritesAdminJSON(t *testing.T) {
	var buf bytes.Buffer
	logger := NewWriterLogger(&buf)
	if err := logger.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}
	logger.Log("AUTH", "user logged in")
	logger.Logf("METRICS", "last %ds: %d requests", 60, 42)

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 2 {
		t.Fatalf("expected 2 lines, got %d: %q", len(lines), buf.String())
	}
	assertAdminLine(t, lines[0], "AUTH", "user logged in")
	assertAdminLine(t, lines[1], "METRICS", "last 60s: 42 requests")
}

func TestStreamLogger_Concurrent(t *testing.T) {
	var buf bytes.Buffer
	logger := NewWriterLogger(&buf)

	var wg sync.WaitGroup
	for i := range 100 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			logger.Logf("CONC", "entry %d", i)
		}()
	}
	wg.Wait()

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 100 {
		t.Fatalf("expected 100 lines, got %d", len(lines))
	}
	for _, line := range lines {
		assertAdminLine(t, line, "CONC", "")
	}
}

func assertAdminLine(t *testing.T, raw, category, message string) {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		t.Fatalf("unmarshal %q: %v", raw, err)
	}
	if _, ok := m["kind"]; ok {
		t.Fatalf("legacy kind field must not be present: %q", raw)
	}
	if m["event.name"] != "admin" || m["level"] != "info" || m["category"] != category {
		t.Fatalf("unexpected record: %+v", m)
	}
	if m["service.name"] != "pn-api" || m["service.version"] == nil || m["service.version"] == "" {
		t.Fatalf("missing service coordinates: %+v", m)
	}
	timeStr, _ := m["time"].(string)
	if !strings.Contains(timeStr, ".") {
		t.Fatalf("time %q needs millisecond precision", timeStr)
	}
	if message != "" && m["msg"] != message {
		t.Fatalf("msg %q, want %q", m["msg"], message)
	}
}

type closeProbe struct {
	buf    bytes.Buffer
	closed bool
}

func (p *closeProbe) Write(b []byte) (int, error) { return p.buf.Write(b) }
func (p *closeProbe) Close() error {
	p.closed = true
	return nil
}

type errWriter struct{}

func (errWriter) Write([]byte) (int, error) { return 0, errors.New("write failed") }

type panicWriter struct{}

func (panicWriter) Write([]byte) (int, error) { panic("write panic") }

func TestStreamLogger_CloseDoesNotCloseWriter(t *testing.T) {
	probe := &closeProbe{}
	logger := NewWriterLogger(probe)
	if err := logger.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}
	if probe.closed {
		t.Fatal("Close closed the injected writer")
	}
	logger.Log("AUTH", "still open")
	assertAdminLine(t, strings.TrimSpace(probe.buf.String()), "AUTH", "still open")
}

func TestStreamLogger_WriteErrorDoesNotPanic(t *testing.T) {
	logger := NewWriterLogger(errWriter{})
	logger.Log("ERROR", "disk full")
}

func TestStreamLogger_WritePanicIsRecovered(t *testing.T) {
	logger := NewWriterLogger(panicWriter{})
	logger.Log("ERROR", "writer panicked")
}

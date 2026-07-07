package admin

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHTTPLoggingMiddleware_Logs5xxAndRecordsMetrics(t *testing.T) {
	logger := &fakeLogger{}
	collector := NewMetricsCollector()

	mw := HTTPLoggingMiddleware(logger, collector, func(r *http.Request) string { return "user-1" })
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("boom"))
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}

	collector.Flush(logger)

	if len(logger.logs) != 2 {
		t.Fatalf("expected 2 logs, got %d: %v", len(logger.logs), logger.logs)
	}
	if !contains(logger.logs[0], "[ERROR]") {
		t.Fatalf("expected [ERROR] log, got %s", logger.logs[0])
	}
	if !contains(logger.logs[1], "[METRICS]") {
		t.Fatalf("expected [METRICS] log, got %s", logger.logs[1])
	}
}

func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}

func TestHTTPLoggingMiddleware_HandlerPanicPropagates(t *testing.T) {
	mw := HTTPLoggingMiddleware(&fakeLogger{}, NewMetricsCollector(), nil)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("handler panic")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	rec := httptest.NewRecorder()

	defer func() {
		if rec := recover(); rec == nil {
			t.Fatal("expected handler panic to propagate")
		}
	}()
	handler.ServeHTTP(rec, req)
}

func TestHTTPLoggingMiddleware_NilLogger(t *testing.T) {
	mw := HTTPLoggingMiddleware(nil, NewMetricsCollector(), nil)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestHTTPLoggingMiddleware_NilCollector(t *testing.T) {
	logger := &fakeLogger{}
	mw := HTTPLoggingMiddleware(logger, nil, nil)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
	if len(logger.logs) != 1 || !contains(logger.logs[0], "[ERROR]") {
		t.Fatalf("expected one ERROR log, got %v", logger.logs)
	}
}

type panicCollector struct{}

func (panicCollector) RecordRequest(int, int64, string) {
	panic("collector panic")
}

func TestHTTPLoggingMiddleware_PanickingCollector(t *testing.T) {
	logger := &fakeLogger{}
	mw := HTTPLoggingMiddleware(logger, panicCollector{}, nil)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
	if len(logger.logs) != 0 {
		t.Fatalf("expected no logs after collector panic, got %v", logger.logs)
	}
}

type panicLogger struct{}

func (panicLogger) Log(string, string)                   {}
func (panicLogger) Logf(string, string, ...interface{}) { panic("logger panic") }
func (panicLogger) Close() error                         { return nil }

func TestHTTPLoggingMiddleware_PanickingLogger(t *testing.T) {
	collector := NewMetricsCollector()
	mw := HTTPLoggingMiddleware(panicLogger{}, collector, nil)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}

	logger := &fakeLogger{}
	collector.Flush(logger)
	if len(logger.logs) != 1 || !contains(logger.logs[0], "[METRICS]") {
		t.Fatalf("expected one METRICS log, got %v", logger.logs)
	}
}

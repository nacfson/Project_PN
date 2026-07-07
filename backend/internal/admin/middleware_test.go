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

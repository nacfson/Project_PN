package httpx_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"project-pn/internal/httpx"
	"project-pn/internal/logx"
)

func TestMiddlewareParsesTraceparentAndLogsAccessLine(t *testing.T) {
	var buf bytes.Buffer
	logger := logx.New(&buf, "pn-api", "v1.4.2")

	var handlerTraceID string
	h := httpx.Middleware(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerTraceID = httpx.TraceIDFromContext(r.Context())
		httpx.LoggerFromContext(r.Context()).Info("inside handler")
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/words/lookup", nil)
	req.Header.Set("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if handlerTraceID != "4bf92f3577b34da6a3ce929d0e0e4736" {
		t.Fatalf("handlerTraceID = %q, want 4bf92f3577b34da6a3ce929d0e0e4736", handlerTraceID)
	}

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 2 {
		t.Fatalf("expected 2 log lines, got %d:\n%s", len(lines), buf.String())
	}

	var handlerLine, accessLine map[string]any
	if err := json.Unmarshal([]byte(lines[0]), &handlerLine); err != nil {
		t.Fatalf("unmarshal handler line: %v", err)
	}
	if err := json.Unmarshal([]byte(lines[1]), &accessLine); err != nil {
		t.Fatalf("unmarshal access line: %v", err)
	}

	if handlerLine["trace_id"] != "4bf92f3577b34da6a3ce929d0e0e4736" {
		t.Fatalf("handler line trace_id = %v", handlerLine["trace_id"])
	}
	if accessLine["trace_id"] != "4bf92f3577b34da6a3ce929d0e0e4736" {
		t.Fatalf("access line trace_id = %v", accessLine["trace_id"])
	}
	if accessLine["level"] != "INFO" {
		t.Fatalf("access line level = %v, want INFO", accessLine["level"])
	}
	if accessLine["http.request.method"] != "GET" {
		t.Fatalf("http.request.method = %v, want GET", accessLine["http.request.method"])
	}
	if accessLine["url.path"] != "/api/words/lookup" {
		t.Fatalf("url.path = %v, want /api/words/lookup", accessLine["url.path"])
	}
	if accessLine["http.response.status_code"] != float64(200) {
		t.Fatalf("http.response.status_code = %v, want 200", accessLine["http.response.status_code"])
	}
	if _, ok := accessLine["http.server.request.duration"].(float64); !ok {
		t.Fatalf("http.server.request.duration missing or not float: %v", accessLine["http.server.request.duration"])
	}
}

func TestMiddlewareGeneratesTraceIDAndLogsErrorOn5xx(t *testing.T) {
	var buf bytes.Buffer
	logger := logx.New(&buf, "pn-api", "v1.4.2")

	h := httpx.Middleware(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/words/enrich", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	var accessLine map[string]any
	if err := json.Unmarshal(buf.Bytes(), &accessLine); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	tid, _ := accessLine["trace_id"].(string)
	if !regexp.MustCompile(`^[0-9a-f]{32}$`).MatchString(tid) {
		t.Fatalf("generated trace_id %q does not match ^[0-9a-f]{32}$", tid)
	}
	if accessLine["level"] != "ERROR" {
		t.Fatalf("level = %v, want ERROR for status 502", accessLine["level"])
	}
	if accessLine["http.response.status_code"] != float64(502) {
		t.Fatalf("http.response.status_code = %v, want 502", accessLine["http.response.status_code"])
	}
	if accessLine["exception.message"] == nil || accessLine["exception.message"] == "" {
		t.Fatalf("5xx access line must include exception.message for §3 conformance: %v", accessLine)
	}
}

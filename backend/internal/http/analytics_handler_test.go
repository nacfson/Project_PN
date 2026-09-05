package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"project-pn/internal/analytics"
)

type captureAnalyticsLogger struct {
	mu     sync.Mutex
	events []analytics.Record
}

func (l *captureAnalyticsLogger) Emit(record analytics.Record) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.events = append(l.events, record)
}

func analyticsPayload(t *testing.T, events ...map[string]any) []byte {
	t.Helper()
	payload, err := json.Marshal(map[string]any{"events": events})
	if err != nil {
		t.Fatal(err)
	}
	return payload
}

func validAnalyticsEvent() map[string]any {
	return map[string]any{
		"event_name":    "word_lookup_succeeded",
		"event_version": 1,
		"event_id":      "6ea32d0e-3c6b-4e0d-9fe1-3a57e7d468f1",
		"occurred_at":   time.Now().UTC().Format(time.RFC3339Nano),
		"session_id":    "8d30c572-0d28-43ef-98c1-98d7d49b7f93",
		"trace_id":      "d01bb929-6f39-4d3e-bb53-ecc3d87d337d",
		"anonymous_id":  "7678227c-f627-473d-9dd1-06bc2ae79497",
		"platform":      "web",
		"app_version":   "1.0.0",
		"properties":    map[string]any{"word": "learn"},
	}
}

func TestAnalyticsEndpointAcceptsAnonymousBatch(t *testing.T) {
	logger := &captureAnalyticsLogger{}
	router := NewRouter(Dependencies{AnalyticsEnabled: true, AnalyticsLogger: logger})
	req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", bytes.NewReader(analyticsPayload(t, validAnalyticsEvent())))
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if len(logger.events) != 1 || logger.events[0].Kind != "analytics" {
		t.Fatalf("emitted events = %#v", logger.events)
	}
}

func TestAnalyticsEndpointRejectsTokenBearingEvent(t *testing.T) {
	logger := &captureAnalyticsLogger{}
	router := NewRouter(Dependencies{AnalyticsEnabled: true, AnalyticsLogger: logger})
	event := validAnalyticsEvent()
	event["properties"] = map[string]any{"refresh_token": "must-not-log"}
	req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", bytes.NewReader(analyticsPayload(t, event)))
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "forbidden") {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if len(logger.events) != 0 {
		t.Fatalf("unexpected emitted events = %#v", logger.events)
	}
}

func TestAnalyticsEndpointRejectsOversizedBatch(t *testing.T) {
	router := NewRouter(Dependencies{AnalyticsEnabled: true, AnalyticsLogger: &captureAnalyticsLogger{}})
	event := validAnalyticsEvent()
	event["properties"] = map[string]any{"word": strings.Repeat("x", 256*1024)}
	req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", bytes.NewReader(analyticsPayload(t, event)))
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestAnalyticsEndpointIsNotRegisteredWhenDisabled(t *testing.T) {
	router := NewRouter(Dependencies{AnalyticsEnabled: false, AnalyticsLogger: &captureAnalyticsLogger{}})
	req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rec.Code)
	}
}

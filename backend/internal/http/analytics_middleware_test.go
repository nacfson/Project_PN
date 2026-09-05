package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"project-pn/internal/analytics"
)

func TestAnalyticsRequestMiddlewareEmitsAuthoritativeOutcomeWithClientTrace(t *testing.T) {
	logger := &captureAnalyticsLogger{}
	handler := analyticsRequestMiddleware(logger)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	req := httptest.NewRequest(http.MethodPost, "/api/learning-items", nil)
	req.Header.Set("X-Client-Trace-Id", "d01bb929-6f39-4d3e-bb53-ecc3d87d337d")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if len(logger.events) != 1 {
		t.Fatalf("events = %#v", logger.events)
	}
	event := logger.events[0]
	if event.EventName != "api_request_completed" || event.TraceID != "d01bb929-6f39-4d3e-bb53-ecc3d87d337d" {
		t.Fatalf("event = %#v", event)
	}
	if event.Properties["status"] != http.StatusCreated {
		t.Fatalf("properties = %#v", event.Properties)
	}
	if err := analytics.Validate(event.Event); err != nil {
		t.Fatalf("invalid event: %v", err)
	}
}

package analytics

import (
	"strings"
	"testing"
	"time"
)

func validEvent() Event {
	return Event{
		EventName:    "word_lookup_succeeded",
		EventVersion: 1,
		EventID:      "6ea32d0e-3c6b-4e0d-9fe1-3a57e7d468f1",
		OccurredAt:   time.Now().UTC().Format(time.RFC3339Nano),
		SessionID:    "8d30c572-0d28-43ef-98c1-98d7d49b7f93",
		TraceID:      "d01bb929-6f39-4d3e-bb53-ecc3d87d337d",
		AnonymousID:  "7678227c-f627-473d-9dd1-06bc2ae79497",
		Platform:     "web",
		AppVersion:   "1.0.0",
		Properties:   map[string]any{"word": "learn"},
	}
}

func TestValidateAcceptsRegisteredEvent(t *testing.T) {
	event := validEvent()
	if err := Validate(event); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
}

func TestValidateRejectsUnknownEvent(t *testing.T) {
	event := validEvent()
	event.EventName = "surprise_event"
	if err := Validate(event); err == nil || !strings.Contains(err.Error(), "event_name") {
		t.Fatalf("Validate() error = %v, want unknown event_name error", err)
	}
}

func TestValidateRejectsCredentialsInProperties(t *testing.T) {
	event := validEvent()
	event.Properties = map[string]any{"access_token": "secret"}
	if err := Validate(event); err == nil || !strings.Contains(err.Error(), "forbidden") {
		t.Fatalf("Validate() error = %v, want forbidden property error", err)
	}
}

func TestValidateRejectsMissingProperties(t *testing.T) {
	event := validEvent()
	event.Properties = nil
	if err := Validate(event); err == nil || !strings.Contains(err.Error(), "properties") {
		t.Fatalf("Validate() error = %v, want properties error", err)
	}
}

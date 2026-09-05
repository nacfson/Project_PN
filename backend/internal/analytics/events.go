// Package analytics owns the versioned, append-only product event contract.
// Records deliberately contain no credentials and are safe for a log collector
// to forward to the platform analytics sink.
package analytics

import (
	"crypto/rand"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

const CurrentEventVersion = 1

var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

var allowedEventNames = map[string]struct{}{
	"session_started": {}, "session_ended": {}, "screen_viewed": {},
	"command_invoked": {}, "command_completed": {}, "validation_failed": {}, "validation_succeeded": {},
	"auth_started": {}, "auth_succeeded": {}, "auth_failed": {}, "verification_started": {}, "verification_succeeded": {}, "verification_failed": {},
	"word_capture_started": {}, "word_capture_completed": {}, "word_lookup_requested": {}, "word_lookup_succeeded": {}, "word_lookup_failed": {},
	"meaning_search_requested": {}, "meaning_search_succeeded": {}, "meaning_search_failed": {}, "sense_selected": {}, "sense_changed": {},
	"word_add_requested": {}, "word_add_succeeded": {}, "word_add_failed": {}, "card_revealed": {}, "card_rated": {},
	"review_succeeded": {}, "review_failed": {}, "deck_created": {}, "deck_renamed": {}, "deck_moved": {}, "deck_deleted": {},
	"settings_changed": {}, "api_request_completed": {}, "api_request_failed": {}, "error_displayed": {}, "retry_requested": {},
}

// Event is the shared producer contract. authenticated_user_id is ignored on
// ingestion and replaced only with identity verified by the API.
type Event struct {
	EventName           string         `json:"event_name"`
	EventVersion        int            `json:"event_version"`
	EventID             string         `json:"event_id"`
	OccurredAt          string         `json:"occurred_at"`
	SessionID           string         `json:"session_id"`
	TraceID             string         `json:"trace_id"`
	AnonymousID         string         `json:"anonymous_id"`
	AuthenticatedUserID string         `json:"authenticated_user_id,omitempty"`
	Platform            string         `json:"platform"`
	AppVersion          string         `json:"app_version"`
	Properties          map[string]any `json:"properties"`
}

type Batch struct {
	Events []Event `json:"events"`
}

// Record is exactly one JSON log line accepted by the Vector analytics filter.
type Record struct {
	Kind string `json:"kind"`
	Event
}

func Validate(event Event) error {
	if _, ok := allowedEventNames[event.EventName]; !ok {
		return fmt.Errorf("event_name is not registered")
	}
	if event.EventVersion != CurrentEventVersion {
		return fmt.Errorf("event_version must be %d", CurrentEventVersion)
	}
	for name, value := range map[string]string{
		"event_id": event.EventID, "session_id": event.SessionID, "trace_id": event.TraceID, "anonymous_id": event.AnonymousID,
	} {
		if !uuidPattern.MatchString(strings.ToLower(value)) {
			return fmt.Errorf("%s must be a UUID", name)
		}
	}
	if _, err := time.Parse(time.RFC3339Nano, event.OccurredAt); err != nil {
		return errors.New("occurred_at must be RFC3339")
	}
	if strings.TrimSpace(event.AppVersion) == "" || len(event.AppVersion) > 128 {
		return errors.New("app_version is required and must be at most 128 characters")
	}
	switch event.Platform {
	case "web", "ios", "android", "tauri", "extension", "backend":
	default:
		return errors.New("platform is invalid")
	}
	if event.Properties == nil {
		return errors.New("properties is required")
	}
	if hasForbiddenProperty(event.Properties) {
		return errors.New("properties contains a forbidden credential field")
	}
	return nil
}

// NewID returns a RFC 4122 v4 UUID without adding a runtime dependency.
func NewID() string {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "00000000-0000-4000-8000-000000000000"
	}
	raw[6] = (raw[6] & 0x0f) | 0x40
	raw[8] = (raw[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", raw[0:4], raw[4:6], raw[6:8], raw[8:10], raw[10:16])
}

// NewServerRecord creates a valid API-authored event with generated IDs for
// server-local fields and the validated client trace when provided.
func NewServerRecord(name, traceID string, properties map[string]any) Record {
	if !uuidPattern.MatchString(strings.ToLower(traceID)) {
		traceID = NewID()
	}
	return Record{Kind: "analytics", Event: Event{
		EventName: name, EventVersion: CurrentEventVersion, EventID: NewID(),
		OccurredAt: time.Now().UTC().Format(time.RFC3339Nano), SessionID: NewID(),
		TraceID: traceID, AnonymousID: NewID(), Platform: "backend", AppVersion: "api",
		Properties: properties,
	}}
}

func hasForbiddenProperty(value any) bool {
	switch typed := value.(type) {
	case map[string]any:
		for key, nested := range typed {
			key = strings.ToLower(strings.ReplaceAll(key, "-", "_"))
			switch key {
			case "token", "access_token", "refresh_token", "id_token", "password", "secret", "authorization", "cookie", "set_cookie":
				return true
			}
			if hasForbiddenProperty(nested) {
				return true
			}
		}
	case []any:
		for _, nested := range typed {
			if hasForbiddenProperty(nested) {
				return true
			}
		}
	}
	return false
}
